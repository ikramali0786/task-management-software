import crypto from 'crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import { User } from '../models/User.model';
import { Team } from '../models/Team.model';
import { Task } from '../models/Task.model';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';
import logger from '../utils/logger';
import { sendVerificationEmail } from '../services/email.service';

/**
 * Internal admin/support panel. Every handler here sits behind requireSuperAdmin
 * (see routes/admin.routes), so these endpoints assume the caller is staff.
 */

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/* GET /api/admin/stats — high-level platform numbers. */
export const getStats = asyncHandler(async (_req: Request, res: Response) => {
  const now = Date.now();
  const since7 = new Date(now - 7 * DAY_MS);
  const since30 = new Date(now - 30 * DAY_MS);

  const [users, verifiedUsers, signups7, signups30, teams, tasks, planAgg] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ emailVerified: true }),
    User.countDocuments({ createdAt: { $gte: since7 } }),
    User.countDocuments({ createdAt: { $gte: since30 } }),
    Team.countDocuments({ isArchived: false }),
    Task.countDocuments({ isArchived: false }),
    Team.aggregate([
      { $match: { isArchived: false } },
      { $group: { _id: '$plan', count: { $sum: 1 } } },
    ]),
  ]);

  const byPlan: Record<string, number> = { free: 0, pro: 0, business: 0 };
  for (const row of planAgg) if (row._id) byPlan[row._id] = row.count;
  const paidTeams = byPlan.pro + byPlan.business;

  sendSuccess(res, {
    stats: {
      users,
      verifiedUsers,
      signups7,
      signups30,
      teams,
      tasks,
      paidTeams,
      byPlan,
    },
  });
});

/* GET /api/admin/users?q=&page=&limit= — search/list users. */
export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const q = ((req.query.q as string) || '').trim();
  const page = Math.max(1, parseInt((req.query.page as string) || '1', 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt((req.query.limit as string) || '25', 10) || 25));

  const filter: Record<string, unknown> = {};
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { username: rx }];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('name email username avatar emailVerified isActive createdAt lastSeenAt')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  // One aggregate for owned-team counts across the whole page (avoids N+1).
  const ids = users.map((u) => u._id);
  const ownedAgg = await Team.aggregate([
    { $match: { owner: { $in: ids }, isArchived: false } },
    { $group: { _id: '$owner', count: { $sum: 1 } } },
  ]);
  const ownedMap: Record<string, number> = {};
  for (const r of ownedAgg) ownedMap[r._id.toString()] = r.count;

  sendSuccess(res, {
    users: users.map((u) => ({ ...u, ownedTeams: ownedMap[u._id.toString()] || 0 })),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
});

/* GET /api/admin/users/:userId — one user, with their teams + task load. */
export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.userId)
    .select('name email username avatar emailVerified isActive twoFactorEnabled timezone createdAt lastSeenAt')
    .lean();
  if (!user) throw new ApiError(404, 'User not found.');

  const [teams, assignedTasks] = await Promise.all([
    Team.find({ 'members.user': user._id, isArchived: false })
      .select('name slug plan planStatus members owner currentPeriodEnd')
      .lean(),
    Task.countDocuments({ assignees: user._id, isArchived: false }),
  ]);

  const teamSummaries = teams.map((t: any) => {
    const m = (t.members || []).find((mm: any) => mm.user?.toString() === user._id.toString());
    return {
      id: t._id.toString(),
      name: t.name,
      slug: t.slug,
      plan: t.plan,
      planStatus: t.planStatus,
      memberCount: (t.members || []).length,
      isOwner: t.owner?.toString() === user._id.toString(),
      role: m?.role ?? null,
      currentPeriodEnd: t.currentPeriodEnd ?? null,
    };
  });

  sendSuccess(res, { user: { ...user, assignedTasks, teams: teamSummaries } });
});

/* PATCH /api/admin/teams/:teamId/plan — manually override a team's plan.
 * Support action: comp an account, fix a stuck subscription, downgrade abuse. */
export const setTeamPlan = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    plan: z.enum(['free', 'pro', 'business']),
    planStatus: z.enum(['active', 'past_due', 'canceled']).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const team = await Team.findById(req.params.teamId);
  if (!team) throw new ApiError(404, 'Team not found.');

  const before = { plan: team.plan, planStatus: team.planStatus };
  team.plan = parsed.data.plan;
  if (parsed.data.planStatus) team.planStatus = parsed.data.planStatus;
  else if (parsed.data.plan === 'free') team.planStatus = 'canceled';
  else team.planStatus = 'active';
  await team.save();

  logger.info(
    `[admin] ${req.user!.email} set team ${team._id} plan ${before.plan}/${before.planStatus} → ${team.plan}/${team.planStatus}`
  );

  sendSuccess(res, { team: { id: team._id.toString(), plan: team.plan, planStatus: team.planStatus } }, 'Plan updated.');
});

/* POST /api/admin/users/:userId/resend-verification — re-send the verify email. */
export const resendVerification = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.userId);
  if (!user) throw new ApiError(404, 'User not found.');
  if (user.emailVerified) throw new ApiError(400, 'This user is already verified.');

  const raw = crypto.randomBytes(32).toString('hex');
  user.emailVerificationTokenHash = hashToken(raw);
  user.emailVerificationExpires = new Date(Date.now() + EMAIL_VERIFY_TTL_MS);
  await user.save();

  const verifyUrl = `${env.CLIENT_URL.replace(/\/$/, '')}/verify-email?token=${raw}`;
  await sendVerificationEmail(user.email, user.name, verifyUrl);
  logger.info(`[admin] ${req.user!.email} resent verification to ${user.email}`);

  sendSuccess(res, null, 'Verification email sent.');
});

/* POST /api/admin/users/:userId/verify — force-mark a user as verified (support). */
export const forceVerifyUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.userId);
  if (!user) throw new ApiError(404, 'User not found.');

  user.emailVerified = true;
  user.emailVerificationTokenHash = null;
  user.emailVerificationExpires = null;
  await user.save();
  logger.info(`[admin] ${req.user!.email} force-verified ${user.email}`);

  sendSuccess(res, { emailVerified: true }, 'User marked as verified.');
});
