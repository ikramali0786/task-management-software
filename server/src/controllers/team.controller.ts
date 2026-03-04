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
  const slug = generateSlug(parsed.data.name);

  const team = await Team.create({
    ...parsed.data,
    slug,
    owner: userId,
    members: [{ user: userId, role: 'admin' }],
  });

  await User.findByIdAndUpdate(userId, { $addToSet: { teams: team._id } });

  sendSuccess(res, { team }, 'Team created.', 201);
});

export const getMyTeams = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id;
  const teams = await Team.find({ 'members.user': userId, isArchived: false })
    .populate('members.user', 'name avatar email')
    .populate('owner', 'name avatar');

  sendSuccess(res, { teams });
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

  sendSuccess(res, { team });
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

  const member = team.members.find((m) => m.user.toString() === req.user!._id.toString());
  if (!member || member.role !== 'admin') throw new ApiError(403, 'Admin only.');

  Object.assign(team, parsed.data);
  await team.save();

  sendSuccess(res, { team });
});

export const generateInviteCode = asyncHandler(async (req: Request, res: Response) => {
  const team = await Team.findById(req.params.teamId);
  if (!team) throw new ApiError(404, 'Team not found.');

  const member = team.members.find((m) => m.user.toString() === req.user!._id.toString());
  if (!member || member.role !== 'admin') throw new ApiError(403, 'Admin only.');

  const code = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  team.inviteCodes.push({ code, expiresAt, usedBy: null as any });
  await team.save();

  sendSuccess(res, { inviteCode: code, expiresAt }, 'Invite code generated.', 201);
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

  const alreadyMember = team.members.some((m) => m.user.toString() === userId);
  if (alreadyMember) throw new ApiError(409, 'Already a member of this team.');

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
  sendSuccess(res, { team }, 'Joined team successfully.');
});

export const removeMember = asyncHandler(async (req: Request, res: Response) => {
  const { teamId, userId } = req.params;
  const team = await Team.findById(teamId);
  if (!team) throw new ApiError(404, 'Team not found.');

  const requestingMember = team.members.find(
    (m) => m.user.toString() === req.user!._id.toString()
  );
  if (!requestingMember || requestingMember.role !== 'admin') throw new ApiError(403, 'Admin only.');
  if (team.owner.toString() === userId) throw new ApiError(400, 'Cannot remove team owner.');

  team.members = team.members.filter((m) => m.user.toString() !== userId) as any;
  await team.save();
  await User.findByIdAndUpdate(userId, { $pull: { teams: team._id } });

  const io = getIO();
  if (io) io.to(`team:${teamId}`).emit('member:left', { teamId, userId });

  sendSuccess(res, null, 'Member removed.');
});

export const updateMemberRole = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({ role: z.enum(['admin', 'member']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Valid role required.');

  const { teamId, userId } = req.params;
  const team = await Team.findById(teamId);
  if (!team) throw new ApiError(404, 'Team not found.');

  const requestingMember = team.members.find(
    (m) => m.user.toString() === req.user!._id.toString()
  );
  if (!requestingMember || requestingMember.role !== 'admin') throw new ApiError(403, 'Admin only.');

  const targetMember = team.members.find((m) => m.user.toString() === userId);
  if (!targetMember) throw new ApiError(404, 'Member not found.');

  targetMember.role = parsed.data.role;
  await team.save();

  sendSuccess(res, null, 'Role updated.');
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
