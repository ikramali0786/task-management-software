import { Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { Team } from '../models/Team.model';
import { User } from '../models/User.model';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { createNotification } from '../services/notification.service';
import { getIO } from '../config/socket';
import { env } from '../config/env';
import { sendTeamInviteEmail } from '../services/email.service';
import {
  serializeTeam,
  serializeTeams,
  assertFeature,
  assertMemberCapacity,
  assertTeamCapacity,
} from '../utils/teamPlan';
import { assertPermission } from '../utils/permissions';

const generateSlug = (name: string): string => {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 50) +
    '-' +
    Math.random().toString(36).slice(2, 6)
  );
};

export const createTeam = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    name: z.string().min(2).max(80),
    description: z.string().max(300).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const userId = req.user!._id.toString();

  // Plan gate: Free owners are capped on how many teams they can create.
  const ownedCount = await Team.countDocuments({ owner: userId, isArchived: false });
  await assertTeamCapacity(ownedCount, req.user!.email);

  const slug = generateSlug(parsed.data.name);

  const team = await Team.create({
    ...parsed.data,
    slug,
    owner: userId,
    members: [{ user: userId, role: 'admin' }],
  });

  await User.findByIdAndUpdate(userId, { $addToSet: { teams: team._id } });

  sendSuccess(res, { team: await serializeTeam(team, req.user!.email) }, 'Team created.', 201);
});

export const getMyTeams = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id;
  const teams = await Team.find({ 'members.user': userId, isArchived: false })
    .populate('members.user', 'name avatar email lastSeenAt')
    .populate('owner', 'name avatar email');

  sendSuccess(res, { teams: await serializeTeams(teams, req.user!.email) });
});

export const getTeam = asyncHandler(async (req: Request, res: Response) => {
  const team = await Team.findById(req.params.teamId)
    .populate('members.user', 'name avatar email lastSeenAt')
    .populate('owner', 'name avatar email');

  if (!team) throw new ApiError(404, 'Team not found.');

  const isMember = team.members.some(
    (m) => m.user._id.toString() === req.user!._id.toString()
  );
  if (!isMember) throw new ApiError(403, 'Not a member of this team.');

  sendSuccess(res, { team: await serializeTeam(team, req.user!.email) });
});

export const updateTeam = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    name: z.string().min(2).max(80).optional(),
    description: z.string().max(300).optional(),
    avatar: z.string().url().optional().nullable(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const team = await Team.findById(req.params.teamId);
  if (!team) throw new ApiError(404, 'Team not found.');

  assertPermission(team, req.user!._id.toString(), 'manageTeamSettings', 'You don\'t have permission to edit team settings.');

  Object.assign(team, parsed.data);
  await team.save();

  sendSuccess(res, { team });
});

export const generateInviteCode = asyncHandler(async (req: Request, res: Response) => {
  const team = await Team.findById(req.params.teamId);
  if (!team) throw new ApiError(404, 'Team not found.');

  assertPermission(team, req.user!._id.toString(), 'inviteMembers', "You don't have permission to invite members.");

  const code = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  team.inviteCodes.push({ code, expiresAt, usedBy: null as any });
  await team.save();

  sendSuccess(res, { inviteCode: code, expiresAt }, 'Invite code generated.', 201);
});

/* ── INVITE BY EMAIL ─────────────────────────────────────────────────────── */
// Generates a longer-lived invite code (7 days) and emails the recipient a
// link to /join?code=… . Unlike the 5-minute copy-paste codes, these need to
// survive long enough for someone to open their inbox and act on it.
export const inviteByEmail = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'A valid email address is required.');
  const { email } = parsed.data;

  const team = await Team.findById(req.params.teamId);
  if (!team) throw new ApiError(404, 'Team not found.');

  assertPermission(team, req.user!._id.toString(), 'inviteMembers', "You don't have permission to invite members.");

  // Don't bother inviting someone who's already on the team.
  const existing = await User.findOne({ email });
  if (existing && team.members.some((m) => m.user.toString() === existing._id.toString())) {
    throw new ApiError(409, 'That person is already a member of this team.');
  }

  const code = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  team.inviteCodes.push({ code, expiresAt, usedBy: null as any });
  await team.save();

  const inviteUrl = `${env.CLIENT_URL.replace(/\/$/, '')}/join?code=${code}`;
  try {
    await sendTeamInviteEmail(email, req.user!.name, team.name, inviteUrl);
  } catch {
    throw new ApiError(502, 'Could not send the invite email right now. Please try again shortly.');
  }

  sendSuccess(res, { email, expiresAt }, `Invite sent to ${email}.`, 201);
});

export const joinTeam = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({ code: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invite code is required.');

  const userId = req.user!._id.toString();

  const team = await Team.findOne({
    'inviteCodes.code': parsed.data.code,
    'inviteCodes.expiresAt': { $gt: new Date() },
    'inviteCodes.usedBy': null,
  });

  if (!team) throw new ApiError(400, 'Invalid or expired invite code.');

  // Team lock prevents new members from joining
  if (team.settings?.isLocked) {
    throw new ApiError(403, 'This team is locked. New members cannot join at this time.');
  }

  const alreadyMember = team.members.some((m) => m.user.toString() === userId);
  if (alreadyMember) throw new ApiError(409, 'Already a member of this team.');

  // Plan gate: Free teams are capped on member count.
  await assertMemberCapacity(team, req.user!.email);

  team.members.push({ user: new (require('mongoose').Types.ObjectId)(userId), role: 'member', joinedAt: new Date() });

  const invite = team.inviteCodes.find((c) => c.code === parsed.data.code)!;
  invite.usedBy = new (require('mongoose').Types.ObjectId)(userId);

  await team.save();
  await User.findByIdAndUpdate(userId, { $addToSet: { teams: team._id } });

  // Notify all admins
  const admins = team.members.filter((m) => m.role === 'admin' && m.user.toString() !== userId);
  const io = getIO();

  for (const admin of admins) {
    await createNotification({
      recipientId: admin.user.toString(),
      actorId: userId,
      type: 'member_joined',
      teamId: team._id.toString(),
      message: `${req.user!.name} joined your team "${team.name}".`,
    });
  }

  if (io) {
    io.to(`team:${team._id}`).emit('member:joined', {
      teamId: team._id,
      user: { _id: req.user!._id, name: req.user!.name, avatar: req.user!.avatar },
    });
  }

  await team.populate('members.user', 'name avatar email');
  sendSuccess(res, { team: await serializeTeam(team, req.user!.email) }, 'Joined team successfully.');
});

export const removeMember = asyncHandler(async (req: Request, res: Response) => {
  const { teamId, userId } = req.params;
  const team = await Team.findById(teamId);
  if (!team) throw new ApiError(404, 'Team not found.');

  assertPermission(team, req.user!._id.toString(), 'manageMembers', "You don't have permission to manage members.");
  if (team.owner.toString() === userId) throw new ApiError(400, 'Cannot remove team owner.');

  team.members = team.members.filter((m) => m.user.toString() !== userId) as any;
  await team.save();
  await User.findByIdAndUpdate(userId, { $pull: { teams: team._id } });

  const io = getIO();
  if (io) io.to(`team:${teamId}`).emit('member:left', { teamId, userId });

  sendSuccess(res, null, 'Member removed.');
});

export const updateMemberRole = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({ role: z.enum(['admin', 'moderator', 'member', 'viewer']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Valid role required (admin, moderator, member, or viewer).');

  const { teamId, userId } = req.params;
  const team = await Team.findById(teamId);
  if (!team) throw new ApiError(404, 'Team not found.');

  assertPermission(team, req.user!._id.toString(), 'manageMembers', "You don't have permission to manage members.");

  const targetMember = team.members.find((m) => m.user.toString() === userId);
  if (!targetMember) throw new ApiError(404, 'Member not found.');
  if (team.owner.toString() === userId) throw new ApiError(400, 'Cannot change the owner\'s role.');

  const oldRole = targetMember.role;
  targetMember.role = parsed.data.role;
  await team.save();

  // Notify the affected member about the role change
  const io = getIO();
  await createNotification({
    recipientId: userId,
    actorId: req.user!._id.toString(),
    type: 'member_joined', // reuse type for now
    teamId: teamId,
    message: `${req.user!.name} changed your role from "${oldRole}" to "${parsed.data.role}" in "${team.name}".`,
  });
  if (io) {
    io.to(`team:${teamId}`).emit('member:roleChanged', {
      teamId,
      userId,
      newRole: parsed.data.role,
    });
  }

  sendSuccess(res, null, 'Role updated.');
});

// Join a team using only an invite code (no teamId needed — used during signup)
export const joinTeamByCode = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({ code: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invite code is required.');

  const userId = req.user!._id.toString();

  const team = await Team.findOne({
    'inviteCodes.code': parsed.data.code,
    'inviteCodes.expiresAt': { $gt: new Date() },
    'inviteCodes.usedBy': null,
  });

  if (!team) throw new ApiError(400, 'Invalid or expired invite code.');

  // Team lock prevents new members from joining
  if (team.settings?.isLocked) {
    throw new ApiError(403, 'This team is locked. New members cannot join at this time.');
  }

  const alreadyMember = team.members.some((m) => m.user.toString() === userId);
  if (alreadyMember) throw new ApiError(409, 'Already a member of this team.');

  // Plan gate: Free teams are capped on member count.
  await assertMemberCapacity(team, req.user!.email);

  team.members.push({ user: new (require('mongoose').Types.ObjectId)(userId), role: 'member', joinedAt: new Date() });

  const invite = team.inviteCodes.find((c) => c.code === parsed.data.code)!;
  invite.usedBy = new (require('mongoose').Types.ObjectId)(userId);

  await team.save();
  await User.findByIdAndUpdate(userId, { $addToSet: { teams: team._id } });

  const admins = team.members.filter((m) => m.role === 'admin' && m.user.toString() !== userId);
  const io = getIO();
  for (const admin of admins) {
    await createNotification({
      recipientId: admin.user.toString(),
      actorId: userId,
      type: 'member_joined',
      teamId: team._id.toString(),
      message: `${req.user!.name} joined your team "${team.name}".`,
    });
  }
  if (io) {
    io.to(`team:${team._id}`).emit('member:joined', {
      teamId: team._id,
      user: { _id: req.user!._id, name: req.user!.name, avatar: req.user!.avatar },
    });
  }

  await team.populate('members.user', 'name avatar email');
  sendSuccess(res, { team: await serializeTeam(team, req.user!.email) }, 'Joined team successfully.');
});

// Toggle team lock (admin only)
export const toggleTeamLock = asyncHandler(async (req: Request, res: Response) => {
  const team = await Team.findById(req.params.teamId);
  if (!team) throw new ApiError(404, 'Team not found.');

  assertPermission(team, req.user!._id.toString(), 'manageTeamSettings', "You don't have permission to lock this team.");

  team.settings.isLocked = !team.settings.isLocked;
  await team.save();

  const io = getIO();
  if (io) {
    io.to(`team:${team._id}`).emit('team:lockChanged', {
      teamId: team._id,
      isLocked: team.settings.isLocked,
    });
  }

  sendSuccess(res, { isLocked: team.settings.isLocked }, `Team ${team.settings.isLocked ? 'locked' : 'unlocked'}.`);
});

export const leaveTeam = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id.toString();
  const team = await Team.findById(req.params.teamId);
  if (!team) throw new ApiError(404, 'Team not found.');

  if (team.owner.toString() === userId) throw new ApiError(400, 'Owner cannot leave. Transfer ownership first.');

  team.members = team.members.filter((m) => m.user.toString() !== userId) as any;
  await team.save();
  await User.findByIdAndUpdate(userId, { $pull: { teams: team._id } });

  sendSuccess(res, null, 'Left team.');
});

// ── Custom Roles ──────────────────────────────────────────────────────────────

const BUILT_IN_ROLES = [
  {
    _id: 'owner',
    name: 'Owner',
    color: '#ef4444',
    isBuiltIn: true,
    permissions: {
      createTask: true, editOwnTask: true, editAnyTask: true,
      deleteOwnTask: true, deleteAnyTask: true, manageMembers: true,
      manageTeamSettings: true, inviteMembers: true, commentOnTasks: true, viewWorkload: true,
    },
  },
  {
    _id: 'admin',
    name: 'Admin',
    color: '#f97316',
    isBuiltIn: true,
    permissions: {
      createTask: true, editOwnTask: true, editAnyTask: true,
      deleteOwnTask: true, deleteAnyTask: true, manageMembers: true,
      manageTeamSettings: true, inviteMembers: true, commentOnTasks: true, viewWorkload: true,
    },
  },
  {
    _id: 'moderator',
    name: 'Moderator',
    color: '#e8502e',
    isBuiltIn: true,
    permissions: {
      createTask: true, editOwnTask: true, editAnyTask: true,
      deleteOwnTask: true, deleteAnyTask: true, manageMembers: false,
      manageTeamSettings: false, inviteMembers: true, commentOnTasks: true, viewWorkload: true,
    },
  },
  {
    _id: 'member',
    name: 'Member',
    color: '#22c55e',
    isBuiltIn: true,
    permissions: {
      createTask: true, editOwnTask: true, editAnyTask: false,
      deleteOwnTask: true, deleteAnyTask: false, manageMembers: false,
      manageTeamSettings: false, inviteMembers: false, commentOnTasks: true, viewWorkload: true,
    },
  },
  {
    _id: 'viewer',
    name: 'Viewer',
    color: '#94a3b8',
    isBuiltIn: true,
    permissions: {
      createTask: false, editOwnTask: false, editAnyTask: false,
      deleteOwnTask: false, deleteAnyTask: false, manageMembers: false,
      manageTeamSettings: false, inviteMembers: false, commentOnTasks: false, viewWorkload: true,
    },
  },
];

export const getTeamRoles = asyncHandler(async (req: Request, res: Response) => {
  const team = await Team.findById(req.params.teamId);
  if (!team) throw new ApiError(404, 'Team not found.');
  sendSuccess(res, { builtIn: BUILT_IN_ROLES, custom: team.customRoles });
});

export const createCustomRole = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    name: z.string().min(1).max(40),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default('#e8502e'),
    permissions: z.object({
      createTask: z.boolean(), editOwnTask: z.boolean(), editAnyTask: z.boolean(),
      deleteOwnTask: z.boolean(), deleteAnyTask: z.boolean(), manageMembers: z.boolean(),
      manageTeamSettings: z.boolean(), inviteMembers: z.boolean(),
      commentOnTasks: z.boolean(), viewWorkload: z.boolean(),
    }).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const userId = req.user!._id.toString();
  const team = await Team.findById(req.params.teamId);
  if (!team) throw new ApiError(404, 'Team not found.');

  const member = team.members.find((m) => m.user.toString() === userId);
  assertPermission(team, userId, 'manageTeamSettings', "You don't have permission to manage roles.");

  // Plan gate: custom roles are a Pro feature.
  await assertFeature(team, 'customRoles', req.user!.email);

  const nameConflict = [
    ...BUILT_IN_ROLES.map((r) => r.name.toLowerCase()),
    ...team.customRoles.map((r) => r.name.toLowerCase()),
  ].includes(parsed.data.name.toLowerCase());
  if (nameConflict) throw new ApiError(409, 'A role with this name already exists.');

  team.customRoles.push({
    name: parsed.data.name,
    color: parsed.data.color,
    permissions: parsed.data.permissions || {
      createTask: true, editOwnTask: true, editAnyTask: false,
      deleteOwnTask: true, deleteAnyTask: false, manageMembers: false,
      manageTeamSettings: false, inviteMembers: false, commentOnTasks: true, viewWorkload: true,
    },
  } as any);
  await team.save();

  sendSuccess(res, { customRoles: team.customRoles }, 'Custom role created.', 201);
});

export const updateCustomRole = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    name: z.string().min(1).max(40).optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    permissions: z.object({
      createTask: z.boolean(), editOwnTask: z.boolean(), editAnyTask: z.boolean(),
      deleteOwnTask: z.boolean(), deleteAnyTask: z.boolean(), manageMembers: z.boolean(),
      manageTeamSettings: z.boolean(), inviteMembers: z.boolean(),
      commentOnTasks: z.boolean(), viewWorkload: z.boolean(),
    }).partial().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const userId = req.user!._id.toString();
  const team = await Team.findById(req.params.teamId);
  if (!team) throw new ApiError(404, 'Team not found.');

  const member = team.members.find((m) => m.user.toString() === userId);
  assertPermission(team, userId, 'manageTeamSettings', "You don't have permission to manage roles.");

  const roleIdx = team.customRoles.findIndex((r) => r._id.toString() === req.params.roleId);
  if (roleIdx === -1) throw new ApiError(404, 'Custom role not found.');

  if (parsed.data.name) team.customRoles[roleIdx].name = parsed.data.name;
  if (parsed.data.color) team.customRoles[roleIdx].color = parsed.data.color;
  if (parsed.data.permissions) {
    team.customRoles[roleIdx].permissions = {
      ...team.customRoles[roleIdx].permissions,
      ...parsed.data.permissions,
    } as any;
  }

  await team.save();
  sendSuccess(res, { customRoles: team.customRoles });
});

export const deleteCustomRole = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id.toString();
  const team = await Team.findById(req.params.teamId);
  if (!team) throw new ApiError(404, 'Team not found.');

  const member = team.members.find((m) => m.user.toString() === userId);
  assertPermission(team, userId, 'manageTeamSettings', "You don't have permission to manage roles.");

  const role = team.customRoles.find((r) => r._id.toString() === req.params.roleId);
  if (!role) throw new ApiError(404, 'Custom role not found.');

  // Reassign members using this role back to 'member'
  team.members.forEach((m) => {
    if (m.role === role.name) m.role = 'member';
  });
  team.customRoles = team.customRoles.filter((r) => r._id.toString() !== req.params.roleId) as any;
  await team.save();

  sendSuccess(res, { customRoles: team.customRoles }, 'Custom role deleted.');
});

// ── Team Labels ──────────────────────────────────────────────────────────────

export const getLabels = asyncHandler(async (req: Request, res: Response) => {
  const team = await Team.findById(req.params.teamId);
  if (!team) throw new ApiError(404, 'Team not found.');
  const isMember = team.members.some((m) => m.user.toString() === req.user!._id.toString());
  if (!isMember) throw new ApiError(403, 'Not a member of this team.');
  sendSuccess(res, { labels: team.labels });
});

export const addLabel = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    name: z.string().min(1).max(50),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default('#e8502e'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const team = await Team.findById(req.params.teamId);
  if (!team) throw new ApiError(404, 'Team not found.');
  const isMember = team.members.some((m) => m.user.toString() === req.user!._id.toString());
  if (!isMember) throw new ApiError(403, 'Not a member of this team.');

  team.labels.push({ name: parsed.data.name, color: parsed.data.color } as any);
  await team.save();
  sendSuccess(res, { labels: team.labels }, 'Label added.', 201);
});

export const updateLabel = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    name: z.string().min(1).max(50).optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const team = await Team.findById(req.params.teamId);
  if (!team) throw new ApiError(404, 'Team not found.');
  const isMember = team.members.some((m) => m.user.toString() === req.user!._id.toString());
  if (!isMember) throw new ApiError(403, 'Not a member of this team.');

  const label = team.labels.find((l) => l._id.toString() === req.params.labelId);
  if (!label) throw new ApiError(404, 'Label not found.');

  if (parsed.data.name) label.name = parsed.data.name;
  if (parsed.data.color) label.color = parsed.data.color;
  await team.save();
  sendSuccess(res, { labels: team.labels });
});

export const deleteLabel = asyncHandler(async (req: Request, res: Response) => {
  const team = await Team.findById(req.params.teamId);
  if (!team) throw new ApiError(404, 'Team not found.');
  const isMember = team.members.some((m) => m.user.toString() === req.user!._id.toString());
  if (!isMember) throw new ApiError(403, 'Not a member of this team.');

  team.labels = team.labels.filter((l) => l._id.toString() !== req.params.labelId) as any;
  await team.save();
  sendSuccess(res, { labels: team.labels }, 'Label deleted.');
});
