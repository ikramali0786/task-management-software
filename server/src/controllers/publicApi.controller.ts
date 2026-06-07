import { Request, Response } from 'express';
import { z } from 'zod';
import { Task, TaskStatus } from '../models/Task.model';
import { Team } from '../models/Team.model';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { sanitizeText } from '../utils/sanitize';
import { serializeTask } from '../utils/serializeTask';
import { emitTaskCreated, emitTaskUpdated, emitTaskDeleted } from '../services/events.service';

/**
 * Public REST API (v1) — authenticated by an API token (see apiAuth middleware),
 * scoped to the token's team. Responses use the stable `serializeTask` shape.
 *
 * Note: these endpoints return raw JSON envelopes (not the in-app sendSuccess
 * wrapper) so external integrators get a clean, predictable contract.
 */

const populate = [
  { path: 'assignees', select: 'name avatar' },
  { path: 'createdBy', select: 'name avatar' },
];

const nextIdentifier = async (teamId: string): Promise<number> => {
  const t = await Team.findByIdAndUpdate(
    teamId,
    { $inc: { taskCounter: 1 } },
    { new: true, select: 'taskCounter' }
  );
  return t?.taskCounter ?? 1;
};

const maxPosition = async (teamId: string, status: TaskStatus): Promise<number> => {
  const last = await Task.findOne({ team: teamId, status, isArchived: false })
    .sort({ position: -1 })
    .select('position');
  return last ? last.position + 1000 : 1000;
};

/* ── GET /api/v1/me ─────────────────────────────────────────────────────────
 * Token introspection — confirm the token works and see its team + scopes. */
export const apiMe = asyncHandler(async (req: Request, res: Response) => {
  const team = req.apiTeam!;
  const token = req.apiToken!;
  res.json({
    team: { id: team._id.toString(), name: (team as any).name },
    token: { name: token.name, scopes: token.scopes, lastUsedAt: token.lastUsedAt },
  });
});

/* ── GET /api/v1/tasks ──────────────────────────────────────────────────────
 * List tasks for the token's team. Filters: status, priority, assignee, search,
 * includeArchived. Pagination: page, limit (max 100). */
export const apiListTasks = asyncHandler(async (req: Request, res: Response) => {
  const teamId = req.apiTeam!._id.toString();
  const { status, priority, assignee, search, includeArchived } = req.query as Record<string, string>;
  const page = Math.max(1, parseInt((req.query.page as string) || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '50', 10) || 50));

  const filter: Record<string, unknown> = { team: teamId };
  if (includeArchived !== 'true') filter.isArchived = false;
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (assignee) filter.assignees = assignee;
  if (search) filter.$text = { $search: search };

  const [tasks, total] = await Promise.all([
    Task.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate(populate),
    Task.countDocuments(filter),
  ]);

  res.json({
    data: tasks.map(serializeTask),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

/* ── GET /api/v1/tasks/:id ──────────────────────────────────────────────── */
export const apiGetTask = asyncHandler(async (req: Request, res: Response) => {
  const teamId = req.apiTeam!._id.toString();
  const task = await Task.findOne({ _id: req.params.id, team: teamId }).populate(populate);
  if (!task) throw new ApiError(404, 'Task not found.', { code: 'NOT_FOUND' });
  res.json({ data: serializeTask(task) });
});

/* ── POST /api/v1/tasks ─────────────────────────────────────────────────── */
export const apiCreateTask = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(5000).optional(),
    status: z.enum(['todo', 'in_progress', 'review', 'done']).optional(),
    priority: z.enum(['urgent', 'high', 'medium', 'low']).optional(),
    assignees: z.array(z.string()).optional(),
    labels: z.array(z.object({ name: z.string(), color: z.string() })).optional(),
    dueDate: z.string().datetime().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message, { code: 'VALIDATION' });

  const team = req.apiTeam!;
  const teamId = team._id.toString();
  const status = (parsed.data.status || 'todo') as TaskStatus;

  const task = await Task.create({
    identifier: await nextIdentifier(teamId),
    title: sanitizeText(parsed.data.title),
    description: sanitizeText(parsed.data.description || ''),
    team: teamId,
    createdBy: req.apiToken!.createdBy, // attribute to the token's creator
    assignees: parsed.data.assignees || [],
    status,
    priority: parsed.data.priority || 'medium',
    labels: parsed.data.labels || [],
    dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
    completedAt: status === 'done' ? new Date() : null,
    position: await maxPosition(teamId, status),
  });

  const populated = await task.populate(populate);
  emitTaskCreated(teamId, populated);
  res.status(201).json({ data: serializeTask(populated) });
});

/* ── PATCH /api/v1/tasks/:id ────────────────────────────────────────────── */
export const apiUpdateTask = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(5000).optional(),
    status: z.enum(['todo', 'in_progress', 'review', 'done']).optional(),
    priority: z.enum(['urgent', 'high', 'medium', 'low']).optional(),
    assignees: z.array(z.string()).optional(),
    labels: z.array(z.object({ name: z.string(), color: z.string() })).optional(),
    dueDate: z.string().datetime().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message, { code: 'VALIDATION' });

  const teamId = req.apiTeam!._id.toString();
  const task = await Task.findOne({ _id: req.params.id, team: teamId });
  if (!task) throw new ApiError(404, 'Task not found.', { code: 'NOT_FOUND' });

  const d = parsed.data;
  const wasDone = task.status === 'done';
  if (d.title !== undefined) task.title = sanitizeText(d.title);
  if (d.description !== undefined) task.description = sanitizeText(d.description);
  if (d.priority !== undefined) task.priority = d.priority;
  if (d.assignees !== undefined) task.assignees = d.assignees as any;
  if (d.labels !== undefined) task.labels = d.labels as any;
  if (d.dueDate !== undefined) task.dueDate = d.dueDate ? new Date(d.dueDate) : null;
  if (d.status !== undefined) {
    task.status = d.status;
    task.completedAt = d.status === 'done' ? task.completedAt || new Date() : null;
  }
  await task.save();

  const populated = await task.populate(populate);
  const nowDone = populated.status === 'done';
  emitTaskUpdated(teamId, populated, { completed: nowDone && !wasDone });
  res.json({ data: serializeTask(populated) });
});

/* ── DELETE /api/v1/tasks/:id ───────────────────────────────────────────── */
export const apiDeleteTask = asyncHandler(async (req: Request, res: Response) => {
  const teamId = req.apiTeam!._id.toString();
  const task = await Task.findOneAndDelete({ _id: req.params.id, team: teamId });
  if (!task) throw new ApiError(404, 'Task not found.', { code: 'NOT_FOUND' });
  emitTaskDeleted(teamId, task._id.toString(), task);
  res.json({ data: { id: task._id.toString(), deleted: true } });
});
