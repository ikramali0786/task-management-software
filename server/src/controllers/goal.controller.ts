import { Request, Response } from 'express';
import { z } from 'zod';
import { Goal, GOAL_STATUSES } from '../models/Goal.model';
import { Team } from '../models/Team.model';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { sanitizeText } from '../utils/sanitize';
import { hasPermission } from '../utils/permissions';

const verifyMember = async (teamId: string, userId: string) => {
  const team = await Team.findById(teamId);
  if (!team) throw new ApiError(404, 'Team not found.');
  const member = team.members.find((m) => m.user.toString() === userId);
  if (!member) throw new ApiError(403, 'Not a member of this team.');
  return team;
};

/** Objective progress = average of each KR's capped completion (0–100). */
const computeProgress = (keyResults: any[]): number => {
  if (!keyResults || keyResults.length === 0) return 0;
  const sum = keyResults.reduce((acc, kr) => {
    const t = Number(kr.target) || 0;
    const pct = t > 0 ? Math.min(1, Math.max(0, (Number(kr.current) || 0) / t)) : 0;
    return acc + pct;
  }, 0);
  return Math.round((sum / keyResults.length) * 100);
};

const serialize = (g: any) => {
  const obj = typeof g.toObject === 'function' ? g.toObject() : g;
  return {
    id: obj._id.toString(),
    title: obj.title,
    description: obj.description,
    owner: obj.owner
      ? (typeof obj.owner === 'object'
          ? { id: obj.owner._id.toString(), name: obj.owner.name, avatar: obj.owner.avatar }
          : { id: obj.owner.toString() })
      : null,
    status: obj.status,
    dueDate: obj.dueDate || null,
    keyResults: (obj.keyResults || []).map((kr: any) => ({
      id: kr._id.toString(),
      title: kr.title,
      current: kr.current,
      target: kr.target,
      unit: kr.unit,
    })),
    progress: computeProgress(obj.keyResults || []),
    createdBy: obj.createdBy?.toString?.() || obj.createdBy,
    createdAt: obj.createdAt,
  };
};

const keyResultSchema = z.object({
  title: z.string().min(1).max(200),
  current: z.number().optional(),
  target: z.number().optional(),
  unit: z.string().max(20).optional(),
});

const goalBody = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  ownerId: z.string().nullable().optional(),
  status: z.enum([...(GOAL_STATUSES as readonly string[])] as [string, ...string[]]).optional(),
  dueDate: z.string().nullable().optional(),
  keyResults: z.array(keyResultSchema).max(20).optional(),
});

const toKeyResults = (krs?: z.infer<typeof keyResultSchema>[]) =>
  (krs || []).map((kr) => ({
    title: sanitizeText(kr.title),
    current: kr.current ?? 0,
    target: kr.target ?? 100,
    unit: (kr.unit || '').trim(),
  }));

/* GET /goals?teamId=… */
export const listGoals = asyncHandler(async (req: Request, res: Response) => {
  const { teamId } = req.query as Record<string, string>;
  if (!teamId) throw new ApiError(400, 'teamId is required.');
  await verifyMember(teamId, req.user!._id.toString());
  const goals = await Goal.find({ team: teamId }).sort({ createdAt: -1 }).populate('owner', 'name avatar');
  sendSuccess(res, { goals: goals.map(serialize) });
});

/* POST /goals  body: { teamId, ...goal } */
export const createGoal = asyncHandler(async (req: Request, res: Response) => {
  const schema = goalBody.extend({ teamId: z.string() });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  await verifyMember(parsed.data.teamId, req.user!._id.toString());
  const d = parsed.data;
  const goal = await Goal.create({
    team: d.teamId,
    title: sanitizeText(d.title),
    description: sanitizeText(d.description || ''),
    owner: d.ownerId || null,
    status: d.status || 'on_track',
    dueDate: d.dueDate ? new Date(d.dueDate) : null,
    keyResults: toKeyResults(d.keyResults),
    createdBy: req.user!._id,
  });
  const populated = await goal.populate('owner', 'name avatar');
  sendSuccess(res, { goal: serialize(populated) }, 'Goal created.', 201);
});

const loadEditable = async (req: Request) => {
  const goal = await Goal.findById(req.params.id);
  if (!goal) throw new ApiError(404, 'Goal not found.');
  const userId = req.user!._id.toString();
  const team = await verifyMember(goal.team.toString(), userId);
  const isOwnerOrAdmin =
    goal.createdBy.toString() === userId ||
    (goal.owner && goal.owner.toString() === userId) ||
    hasPermission(team, userId, 'manageTeamSettings');
  if (!isOwnerOrAdmin) {
    throw new ApiError(403, 'Only the goal owner, its creator, or a team admin can change it.', { code: 'PERMISSION_DENIED' });
  }
  return goal;
};

/* PATCH /goals/:id */
export const updateGoal = asyncHandler(async (req: Request, res: Response) => {
  const parsed = goalBody.partial().safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const goal = await loadEditable(req);
  const d = parsed.data;
  if (d.title !== undefined) goal.title = sanitizeText(d.title);
  if (d.description !== undefined) goal.description = sanitizeText(d.description);
  if (d.ownerId !== undefined) goal.owner = (d.ownerId as any) || null;
  if (d.status !== undefined) goal.status = d.status as any;
  if (d.dueDate !== undefined) goal.dueDate = d.dueDate ? new Date(d.dueDate) : null;
  if (d.keyResults !== undefined) goal.keyResults = toKeyResults(d.keyResults) as any;
  await goal.save();
  const populated = await goal.populate('owner', 'name avatar');
  sendSuccess(res, { goal: serialize(populated) }, 'Goal updated.');
});

/* DELETE /goals/:id */
export const deleteGoal = asyncHandler(async (req: Request, res: Response) => {
  const goal = await loadEditable(req);
  await goal.deleteOne();
  sendSuccess(res, null, 'Goal deleted.');
});
