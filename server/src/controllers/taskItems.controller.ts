import { Request, Response } from 'express';
import { z } from 'zod';
import { Task } from '../models/Task.model';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { getIO } from '../config/socket';
import { sanitizeText } from '../utils/sanitize';
import { assertCanEditTask } from '../utils/permissions';
import { verifyTeamMember } from './task.shared';

/**
 * Mutations on sub-resources of a single task: subtask checklists, time
 * entries, estimates, custom-field values, external links, and dependencies.
 * Split out from the core task controller to keep each file focused.
 */

/* ── Subtask handlers ─────────────────────────────────────────────────────── */

export const reorderSubtasks = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({ subtaskIds: z.array(z.string()).min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const task = await Task.findById(req.params.taskId);
  if (!task) throw new ApiError(404, 'Task not found.');

  {
    const _uid = req.user!._id.toString();
    const _team = await verifyTeamMember(task.team.toString(), _uid);
    assertCanEditTask(_team, _uid, task);
  }

  // Build a map for O(1) lookup
  const subtaskMap = new Map((task.subtasks as any[]).map((s: any) => [s._id.toString(), s]));

  // Reorder according to provided IDs (skip any IDs not found)
  const reordered = parsed.data.subtaskIds
    .filter((id) => subtaskMap.has(id))
    .map((id) => subtaskMap.get(id)!);

  // Replace the subtasks array in-place
  (task as any).subtasks = reordered;
  await task.save();

  const io = getIO();
  if (io) {
    io.to(`team:${task.team}`).emit('task:updated', {
      taskId: task._id,
      changes: { subtasks: task.subtasks },
    });
  }

  sendSuccess(res, { subtasks: task.subtasks });
});

export const addSubtask = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({ title: z.string().min(1).max(200) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const task = await Task.findById(req.params.taskId);
  if (!task) throw new ApiError(404, 'Task not found.');

  {
    const _uid = req.user!._id.toString();
    const _team = await verifyTeamMember(task.team.toString(), _uid);
    assertCanEditTask(_team, _uid, task);
  }

  (task.subtasks as any).push({ title: sanitizeText(parsed.data.title), completed: false });
  await task.save();

  const io = getIO();
  if (io) {
    io.to(`team:${task.team}`).emit('task:updated', {
      taskId: task._id,
      changes: { subtasks: task.subtasks },
    });
  }

  sendSuccess(res, { subtasks: task.subtasks }, 'Subtask added.', 201);
});

export const updateSubtask = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    title: z.string().min(1).max(200).optional(),
    completed: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const task = await Task.findById(req.params.taskId);
  if (!task) throw new ApiError(404, 'Task not found.');

  {
    const _uid = req.user!._id.toString();
    const _team = await verifyTeamMember(task.team.toString(), _uid);
    assertCanEditTask(_team, _uid, task);
  }

  const subtask = (task.subtasks as any).id(req.params.subtaskId);
  if (!subtask) throw new ApiError(404, 'Subtask not found.');

  if (parsed.data.title !== undefined) subtask.title = sanitizeText(parsed.data.title);
  if (parsed.data.completed !== undefined) subtask.completed = parsed.data.completed;
  await task.save();

  const io = getIO();
  if (io) {
    io.to(`team:${task.team}`).emit('task:updated', {
      taskId: task._id,
      changes: { subtasks: task.subtasks },
    });
  }

  sendSuccess(res, { subtasks: task.subtasks });
});

export const deleteSubtask = asyncHandler(async (req: Request, res: Response) => {
  const task = await Task.findById(req.params.taskId);
  if (!task) throw new ApiError(404, 'Task not found.');

  {
    const _uid = req.user!._id.toString();
    const _team = await verifyTeamMember(task.team.toString(), _uid);
    assertCanEditTask(_team, _uid, task);
  }

  const subtask = (task.subtasks as any).id(req.params.subtaskId);
  if (!subtask) throw new ApiError(404, 'Subtask not found.');

  subtask.deleteOne();
  await task.save();

  const io = getIO();
  if (io) {
    io.to(`team:${task.team}`).emit('task:updated', {
      taskId: task._id,
      changes: { subtasks: task.subtasks },
    });
  }

  sendSuccess(res, { subtasks: task.subtasks }, 'Subtask deleted.');
});

/* ── Time tracking ───────────────────────────────────────────────────────── */

export const logTime = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    minutes: z.number().int().min(1).max(14400),
    note: z.string().max(500).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const task = await Task.findById(req.params.taskId);
  if (!task) throw new ApiError(404, 'Task not found.');

  const userId = req.user!._id.toString();
  {
    const _team = await verifyTeamMember(task.team.toString(), userId);
    assertCanEditTask(_team, userId, task);
  }

  (task.timeEntries as any).push({
    user: userId,
    minutes: parsed.data.minutes,
    note: parsed.data.note || '',
    loggedAt: new Date(),
  });
  await task.save();

  await task.populate('timeEntries.user', 'name avatar');

  const io = getIO();
  if (io) {
    io.to(`team:${task.team}`).emit('task:updated', {
      taskId: task._id,
      changes: { timeEntries: task.timeEntries },
    });
  }

  sendSuccess(res, { timeEntries: task.timeEntries }, 'Time logged.', 201);
});

export const deleteTimeEntry = asyncHandler(async (req: Request, res: Response) => {
  const task = await Task.findById(req.params.taskId);
  if (!task) throw new ApiError(404, 'Task not found.');

  const userId = req.user!._id.toString();
  await verifyTeamMember(task.team.toString(), userId);

  const entry = (task.timeEntries as any).id(req.params.entryId);
  if (!entry) throw new ApiError(404, 'Time entry not found.');
  if (entry.user.toString() !== userId) throw new ApiError(403, "Cannot delete another user's time entry.");

  entry.deleteOne();
  await task.save();

  const io = getIO();
  if (io) {
    io.to(`team:${task.team}`).emit('task:updated', {
      taskId: task._id,
      changes: { timeEntries: task.timeEntries },
    });
  }

  sendSuccess(res, { timeEntries: task.timeEntries }, 'Time entry deleted.');
});

export const updateEstimate = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({ estimatedMinutes: z.number().int().min(1).max(14400).nullable() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const task = await Task.findById(req.params.taskId);
  if (!task) throw new ApiError(404, 'Task not found.');

  {
    const _uid = req.user!._id.toString();
    const _team = await verifyTeamMember(task.team.toString(), _uid);
    assertCanEditTask(_team, _uid, task);
  }

  (task as any).estimatedMinutes = parsed.data.estimatedMinutes;
  await task.save();

  sendSuccess(res, { estimatedMinutes: (task as any).estimatedMinutes });
});

/* ── Custom fields ───────────────────────────────────────────────────────── */

/* PATCH /tasks/:taskId/custom-fields  { values: { [fieldId]: value } } — merge. */
export const updateCustomFields = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({ values: z.record(z.string(), z.any()) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'values object is required.');

  const task = await Task.findById(req.params.taskId);
  if (!task) throw new ApiError(404, 'Task not found.');

  const uid = req.user!._id.toString();
  const team = await verifyTeamMember(task.team.toString(), uid);
  assertCanEditTask(team, uid, task);

  const merged = { ...(task.customFields || {}), ...parsed.data.values };
  // Drop empty values so the bag stays tidy.
  for (const k of Object.keys(merged)) {
    if (merged[k] === '' || merged[k] === null || merged[k] === undefined) delete merged[k];
  }
  task.customFields = merged;
  task.markModified('customFields');
  await task.save();

  const io = getIO();
  if (io) io.to(`team:${task.team}`).emit('task:updated', { taskId: task._id, changes: { customFields: merged } });

  sendSuccess(res, { customFields: merged });
});

/* ── External links ──────────────────────────────────────────────────────── */

/** Detect the provider + a friendly label for an external link. */
const detectLink = (rawUrl: string, label?: string): { url: string; label: string; provider: string } | null => {
  let url: URL;
  try { url = new URL(rawUrl); } catch { return null; }
  if (!/^https?:$/.test(url.protocol)) return null;
  const host = url.host.toLowerCase();
  let provider = 'link';
  let derived = host.replace(/^www\./, '');

  if (host === 'github.com' || host.endsWith('.github.com')) {
    provider = 'github';
    const m = url.pathname.match(/^\/([^/]+)\/([^/]+)\/(?:issues|pull)\/(\d+)/);
    if (m) derived = `${m[1]}/${m[2]}#${m[3]}`;
  } else if (host === 'gitlab.com' || host.endsWith('.gitlab.com')) {
    provider = 'gitlab';
    const m = url.pathname.match(/\/-\/(?:issues|merge_requests)\/(\d+)/);
    if (m) derived = `#${m[1]}`;
  } else if (host.endsWith('atlassian.net') || /\/browse\//.test(url.pathname)) {
    provider = 'jira';
    const m = url.pathname.match(/\/browse\/([A-Za-z][A-Za-z0-9]+-\d+)/);
    if (m) derived = m[1].toUpperCase();
  }
  return { url: rawUrl, label: sanitizeText((label && label.trim()) || derived).slice(0, 120), provider };
};

/* PATCH /tasks/:taskId/links  { links: [{ url, label? }] } — replace the link set. */
export const updateTaskLinks = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    links: z.array(z.object({ url: z.string().url(), label: z.string().max(120).optional() })).max(20),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'A valid links array is required.');

  const task = await Task.findById(req.params.taskId);
  if (!task) throw new ApiError(404, 'Task not found.');
  const uid = req.user!._id.toString();
  const team = await verifyTeamMember(task.team.toString(), uid);
  assertCanEditTask(team, uid, task);

  const links = parsed.data.links.map((l) => detectLink(l.url, l.label)).filter(Boolean) as any[];
  task.links = links;
  await task.save();

  const io = getIO();
  if (io) io.to(`team:${task.team}`).emit('task:updated', { taskId: task._id, changes: { links } });
  sendSuccess(res, { links });
});

/* ── Task dependencies ───────────────────────────────────────────────────── */

const DEP_POPULATE = [
  { path: 'blockedBy', select: '_id title identifier status' },
  { path: 'blocks',    select: '_id title identifier status' },
];

export const addDependency = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({ blockerId: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'blockerId is required.');

  const { taskId } = req.params;
  const { blockerId } = parsed.data;

  if (taskId === blockerId) throw new ApiError(400, 'A task cannot block itself.');

  const task = await Task.findById(taskId);
  if (!task) throw new ApiError(404, 'Task not found.');

  const blockerTask = await Task.findById(blockerId);
  if (!blockerTask) throw new ApiError(404, 'Blocker task not found.');

  const userId = req.user!._id.toString();
  {
    const _team = await verifyTeamMember(task.team.toString(), userId);
    assertCanEditTask(_team, userId, task);
  }

  // Add bidirectionally (addToSet prevents duplicates)
  await Promise.all([
    Task.findByIdAndUpdate(taskId,   { $addToSet: { blockedBy: blockerId } }),
    Task.findByIdAndUpdate(blockerId, { $addToSet: { blocks:    taskId   } }),
  ]);

  const [updatedTask, updatedBlocker] = await Promise.all([
    Task.findById(taskId).populate(DEP_POPULATE),
    Task.findById(blockerId).populate(DEP_POPULATE),
  ]);

  const io = getIO();
  if (io) {
    const teamId = task.team.toString();
    io.to(`team:${teamId}`).emit('task:updated', {
      taskId,
      changes: { blockedBy: updatedTask?.blockedBy, blocks: updatedTask?.blocks },
    });
    io.to(`team:${teamId}`).emit('task:updated', {
      taskId: blockerId,
      changes: { blockedBy: updatedBlocker?.blockedBy, blocks: updatedBlocker?.blocks },
    });
  }

  sendSuccess(res, { task: updatedTask });
});

export const removeDependency = asyncHandler(async (req: Request, res: Response) => {
  const { taskId, blockerId } = req.params;

  const task = await Task.findById(taskId);
  if (!task) throw new ApiError(404, 'Task not found.');

  const userId = req.user!._id.toString();
  {
    const _team = await verifyTeamMember(task.team.toString(), userId);
    assertCanEditTask(_team, userId, task);
  }

  // Remove bidirectionally
  await Promise.all([
    Task.findByIdAndUpdate(taskId,   { $pull: { blockedBy: new (require('mongoose').Types.ObjectId)(blockerId) } }),
    Task.findByIdAndUpdate(blockerId, { $pull: { blocks:    new (require('mongoose').Types.ObjectId)(taskId)   } }),
  ]);

  const [updatedTask, updatedBlocker] = await Promise.all([
    Task.findById(taskId).populate(DEP_POPULATE),
    Task.findById(blockerId).populate(DEP_POPULATE),
  ]);

  const io = getIO();
  if (io) {
    const teamId = task.team.toString();
    io.to(`team:${teamId}`).emit('task:updated', {
      taskId,
      changes: { blockedBy: updatedTask?.blockedBy, blocks: updatedTask?.blocks },
    });
    io.to(`team:${teamId}`).emit('task:updated', {
      taskId: blockerId,
      changes: { blockedBy: updatedBlocker?.blockedBy, blocks: updatedBlocker?.blocks },
    });
  }

  sendSuccess(res, { task: updatedTask });
});
