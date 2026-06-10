import { Request, Response } from 'express';
import { z } from 'zod';
import { Task, TaskStatus } from '../models/Task.model';
import { Team } from '../models/Team.model';
import { User } from '../models/User.model';
import { Comment } from '../models/Comment.model';
import { Attachment } from '../models/Attachment.model';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { createNotification } from '../services/notification.service';
import { getIO } from '../config/socket';
import { sanitizeText } from '../utils/sanitize';
import { assertPermission, assertCanEditTask, assertCanDeleteTask, hasPermission } from '../utils/permissions';
import { emailTaskAssigned } from '../services/emailNotify.service';
import { deliverIntegrations } from '../services/integrationEvents.service';
import { serializeTask } from '../utils/serializeTask';
import { logActivity } from '../services/audit.service';
import { semanticSearchTasks } from '../services/embedding.service';
import { verifyTeamMember, getMaxPosition, recurrenceSchema, spawnNextRecurrence } from './task.shared';

/**
 * Core task lifecycle: create, read, update, status/position moves, delete,
 * cross-team + semantic search, position rebalance, and bulk actions.
 *
 * Related handlers live in sibling controllers, all sharing ./task.shared:
 *   • taskItems.controller    — subtasks, time, custom fields, links, dependencies
 *   • taskAnalytics.controller — stats, dashboard metrics, workload, analytics
 *   • taskExport.controller    — CSV / PDF export
 */

export const createTask = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(5000).optional(),
    teamId: z.string(),
    assignees: z.array(z.string()).optional(),
    status: z.enum(['todo', 'in_progress', 'review', 'done']).optional(),
    priority: z.enum(['urgent', 'high', 'medium', 'low']).optional(),
    labels: z.array(z.object({ name: z.string(), color: z.string() })).optional(),
    startDate: z.string().optional().nullable(),
    dueDate: z.string().optional().nullable(),
    recurrence: recurrenceSchema,
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const userId = req.user!._id.toString();
  const team = await verifyTeamMember(parsed.data.teamId, userId);
  assertPermission(team, userId, 'createTask', "You don't have permission to create tasks in this team.");

  const status = parsed.data.status || 'todo';
  const position = await getMaxPosition(parsed.data.teamId, status as TaskStatus);

  // Atomically increment team's task counter → unique sequential identifier
  const updatedTeam = await Team.findByIdAndUpdate(
    parsed.data.teamId,
    { $inc: { taskCounter: 1 } },
    { new: true, select: 'taskCounter' }
  );
  const identifier = updatedTeam?.taskCounter ?? 1;

  const task = await Task.create({
    identifier,
    title: sanitizeText(parsed.data.title),
    description: sanitizeText(parsed.data.description || ''),
    team: parsed.data.teamId,
    createdBy: userId,
    assignees: parsed.data.assignees || [],
    status,
    priority: parsed.data.priority || 'medium',
    labels: parsed.data.labels || [],
    startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
    dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
    recurrence: parsed.data.recurrence
      ? {
          frequency: parsed.data.recurrence.frequency,
          interval: parsed.data.recurrence.interval || 1,
          endDate: parsed.data.recurrence.endDate ? new Date(parsed.data.recurrence.endDate) : null,
        }
      : { frequency: 'none', interval: 1, endDate: null },
    position,
  });

  const populated = await task.populate([
    { path: 'assignees', select: 'name avatar' },
    { path: 'createdBy', select: 'name avatar' },
  ]);

  // Emit to team room
  const io = getIO();
  if (io) {
    io.to(`team:${parsed.data.teamId}`).emit('task:created', { task: populated });
  }
  deliverIntegrations(parsed.data.teamId, 'task.created', serializeTask(populated));
  logActivity({
    teamId: parsed.data.teamId,
    actorId: userId,
    action: 'task.created',
    target: { type: 'task', id: task._id.toString(), label: `#${identifier} ${task.title}` },
  });

  // Notify assignees
  const createdAssignees = (parsed.data.assignees || []).filter((a) => a !== userId);
  for (const assigneeId of createdAssignees) {
    await createNotification({
      recipientId: assigneeId,
      actorId: userId,
      type: 'task_assigned',
      taskId: task._id.toString(),
      teamId: parsed.data.teamId,
      message: `${req.user!.name} assigned you to "${task.title}".`,
      metadata: { taskTitle: task.title },
    });
  }
  void emailTaskAssigned(createdAssignees, req.user!.name, task.title, team.name);

  sendSuccess(res, { task: populated }, 'Task created.', 201);
});

export const getTasks = asyncHandler(async (req: Request, res: Response) => {
  const { teamId, status, priority, assignee, search, page = '1', limit = '50' } = req.query as Record<string, string>;

  if (!teamId) throw new ApiError(400, 'teamId is required.');

  const userId = req.user!._id.toString();
  await verifyTeamMember(teamId, userId);

  const filter: Record<string, unknown> = { team: teamId, isArchived: false };
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (assignee) filter.assignees = assignee;
  if (search) filter.$text = { $search: search };

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [tasks, total] = await Promise.all([
    Task.find(filter)
      .sort({ status: 1, position: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('assignees', 'name avatar')
      .populate('createdBy', 'name avatar')
      .populate('blockedBy', '_id title identifier status')
      .populate('blocks', '_id title identifier status'),
    Task.countDocuments(filter),
  ]);

  // Attach comment and attachment counts
  const taskIds = tasks.map((t) => t._id);
  const [commentCounts, attachmentCounts] = await Promise.all([
    Comment.aggregate([
      { $match: { task: { $in: taskIds }, isDeleted: false } },
      { $group: { _id: '$task', count: { $sum: 1 } } },
    ]),
    Attachment.aggregate([
      { $match: { task: { $in: taskIds } } },
      { $group: { _id: '$task', count: { $sum: 1 } } },
    ]),
  ]);

  const commentCountMap: Record<string, number> = {};
  for (const r of commentCounts) commentCountMap[r._id.toString()] = r.count;

  const attachmentCountMap: Record<string, number> = {};
  for (const r of attachmentCounts) attachmentCountMap[r._id.toString()] = r.count;

  const tasksWithCounts = tasks.map((t) => ({
    ...t.toObject(),
    commentCount: commentCountMap[t._id.toString()] ?? 0,
    attachmentCount: attachmentCountMap[t._id.toString()] ?? 0,
  }));

  sendSuccess(res, { tasks: tasksWithCounts, total, page: parseInt(page), limit: parseInt(limit) });
});

/* POST /tasks/semantic-search { teamId, query, limit? } — meaning-based search. */
export const semanticSearch = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    teamId: z.string(),
    query: z.string().min(2).max(500),
    limit: z.number().int().min(1).max(50).optional(),
  });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  await verifyTeamMember(parsed.data.teamId, req.user!._id.toString());

  const hits = await semanticSearchTasks(parsed.data.teamId, parsed.data.query, parsed.data.limit ?? 15);
  const results = hits.map(({ task, score }) => ({
    _id: task._id.toString(),
    title: task.title,
    identifier: task.identifier,
    status: task.status,
    priority: task.priority,
    team: parsed.data.teamId,
    score: Math.round(score * 100) / 100,
  }));
  sendSuccess(res, { results });
});

// Cross-team quick search (Cmd+K) — searches titles/descriptions across every
// team the user belongs to, with partial (substring) matching.
export const searchTasks = asyncHandler(async (req: Request, res: Response) => {
  const q = ((req.query.q as string) || '').trim();
  if (q.length < 2) return sendSuccess(res, { tasks: [] });

  const userId = req.user!._id;
  const teams = await Team.find({ 'members.user': userId, isArchived: false }).select('_id name');
  const teamMap = new Map(teams.map((t) => [t._id.toString(), t.name]));

  const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const tasks = await Task.find({
    team: { $in: teams.map((t) => t._id) },
    isArchived: false,
    $or: [{ title: rx }, { description: rx }],
  })
    .select('title identifier status priority team dueDate assignees')
    .sort({ updatedAt: -1 })
    .limit(20)
    .lean();

  const results = tasks.map((t) => ({ ...t, teamName: teamMap.get(t.team.toString()) || '' }));
  sendSuccess(res, { tasks: results });
});

export const getTask = asyncHandler(async (req: Request, res: Response) => {
  const task = await Task.findById(req.params.taskId)
    .populate('assignees', 'name avatar email')
    .populate('createdBy', 'name avatar')
    .populate('team', 'name slug')
    .populate('blockedBy', '_id title identifier status')
    .populate('blocks', '_id title identifier status');

  if (!task) throw new ApiError(404, 'Task not found.');

  await verifyTeamMember(task.team._id.toString(), req.user!._id.toString());

  const [commentCount, attachmentCount] = await Promise.all([
    Comment.countDocuments({ task: task._id, isDeleted: false }),
    Attachment.countDocuments({ task: task._id }),
  ]);

  sendSuccess(res, { task: { ...task.toObject(), commentCount, attachmentCount } });
});

export const updateTask = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(5000).optional(),
    assignees: z.array(z.string()).optional(),
    status: z.enum(['todo', 'in_progress', 'review', 'done']).optional(),
    priority: z.enum(['urgent', 'high', 'medium', 'low']).optional(),
    labels: z.array(z.object({ name: z.string(), color: z.string() })).optional(),
    startDate: z.string().optional().nullable(),
    dueDate: z.string().optional().nullable(),
    position: z.number().optional(),
    recurrence: recurrenceSchema,
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const task = await Task.findById(req.params.taskId);
  if (!task) throw new ApiError(404, 'Task not found.');

  const userId = req.user!._id.toString();
  const team = await verifyTeamMember(task.team.toString(), userId);
  assertCanEditTask(team, userId, task);

  const prevAssignees = task.assignees.map((a) => a.toString());
  const prevStatus = task.status;

  if (parsed.data.recurrence !== undefined) {
    task.recurrence = {
      frequency: parsed.data.recurrence.frequency,
      interval: parsed.data.recurrence.interval || 1,
      endDate: parsed.data.recurrence.endDate ? new Date(parsed.data.recurrence.endDate) : null,
    } as any;
  }

  // Handle completedAt
  if (parsed.data.status === 'done' && task.status !== 'done') {
    (task as any).completedAt = new Date();
  } else if (parsed.data.status && parsed.data.status !== 'done') {
    (task as any).completedAt = null;
  }

  if (parsed.data.dueDate !== undefined) {
    const nextDue = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
    // Reschedule → clear reminder flags so the new due date can notify afresh.
    if (!task.dueDate || !nextDue || task.dueDate.getTime() !== nextDue.getTime()) {
      task.reminderSentAt = null;
      task.overdueSentAt = null;
    }
    task.dueDate = nextDue;
  }

  if (parsed.data.startDate !== undefined) {
    task.startDate = parsed.data.startDate ? new Date(parsed.data.startDate) : null;
  }

  Object.assign(task, {
    ...(parsed.data.title && { title: sanitizeText(parsed.data.title) }),
    ...(parsed.data.description !== undefined && { description: sanitizeText(parsed.data.description) }),
    ...(parsed.data.assignees && { assignees: parsed.data.assignees }),
    ...(parsed.data.status && { status: parsed.data.status }),
    ...(parsed.data.priority && { priority: parsed.data.priority }),
    ...(parsed.data.labels && { labels: parsed.data.labels }),
    ...(parsed.data.position !== undefined && { position: parsed.data.position }),
  });

  await task.save();

  const populated = await task.populate([
    { path: 'assignees', select: 'name avatar' },
    { path: 'createdBy', select: 'name avatar' },
  ]);

  const io = getIO();
  if (io) {
    // Emit populated assignees so every client receives full User objects,
    // not bare IDs — prevents Avatar from crashing on `name.charCodeAt(0)`.
    const socketChanges: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.assignees !== undefined) {
      socketChanges.assignees = (populated as any).assignees;
    }
    io.to(`team:${task.team}`).emit('task:updated', {
      taskId: task._id,
      changes: socketChanges,
    });
  }
  {
    const justDone = parsed.data.status === 'done' && prevStatus !== 'done';
    deliverIntegrations(task.team.toString(), 'task.updated', serializeTask(populated));
    if (justDone) deliverIntegrations(task.team.toString(), 'task.completed', serializeTask(populated));
    logActivity({
      teamId: task.team.toString(),
      actorId: userId,
      action: justDone ? 'task.completed' : 'task.updated',
      target: { type: 'task', id: task._id.toString(), label: `#${task.identifier} ${task.title}` },
      meta: { fields: Object.keys(parsed.data) },
    });
  }

  // Notify new assignees
  const newAssignees = (parsed.data.assignees || []).filter(
    (a) => !prevAssignees.includes(a) && a !== userId
  );
  for (const assigneeId of newAssignees) {
    await createNotification({
      recipientId: assigneeId,
      actorId: userId,
      type: 'task_assigned',
      taskId: task._id.toString(),
      teamId: task.team.toString(),
      message: `${req.user!.name} assigned you to "${task.title}".`,
    });
  }
  void emailTaskAssigned(newAssignees, req.user!.name, task.title, team.name);

  // Notify on completion
  if (parsed.data.status === 'done' && prevStatus !== 'done') {
    const toNotify = prevAssignees.filter((a) => a !== userId);
    for (const recipientId of toNotify) {
      await createNotification({
        recipientId,
        actorId: userId,
        type: 'task_completed',
        taskId: task._id.toString(),
        teamId: task.team.toString(),
        message: `"${task.title}" was marked as done by ${req.user!.name}.`,
      });
    }
    // Recurring task completed → spawn the next occurrence.
    await spawnNextRecurrence(task, userId);
  }

  // Notify existing assignees of meaningful content edits (not the editor, not
  // brand-new assignees who already received task_assigned, not completions).
  const contentChanged =
    parsed.data.title !== undefined ||
    parsed.data.description !== undefined ||
    parsed.data.priority !== undefined ||
    parsed.data.dueDate !== undefined ||
    parsed.data.labels !== undefined ||
    parsed.data.recurrence !== undefined;
  const justCompleted = parsed.data.status === 'done' && prevStatus !== 'done';
  if (contentChanged && !justCompleted) {
    const recipients = prevAssignees.filter((a) => a !== userId && !newAssignees.includes(a));
    for (const recipientId of recipients) {
      await createNotification({
        recipientId,
        actorId: userId,
        type: 'task_updated',
        taskId: task._id.toString(),
        teamId: task.team.toString(),
        message: `${req.user!.name} updated "${task.title}".`,
      });
    }
  }

  sendSuccess(res, { task: populated });
});

export const updateTaskStatus = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({ status: z.enum(['todo', 'in_progress', 'review', 'done']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Valid status required.');

  const task = await Task.findById(req.params.taskId);
  if (!task) throw new ApiError(404, 'Task not found.');

  {
    const uid = req.user!._id.toString();
    const team = await verifyTeamMember(task.team.toString(), uid);
    assertCanEditTask(team, uid, task);
  }

  const prevStatus = task.status;
  task.status = parsed.data.status;
  if (parsed.data.status === 'done' && prevStatus !== 'done') {
    (task as any).completedAt = new Date();
  }
  await task.save();

  const io = getIO();
  if (io) {
    io.to(`team:${task.team}`).emit('task:updated', {
      taskId: task._id,
      changes: { status: parsed.data.status },
    });
  }
  {
    const justDone = parsed.data.status === 'done' && prevStatus !== 'done';
    deliverIntegrations(task.team.toString(), 'task.updated', serializeTask(task));
    if (justDone) deliverIntegrations(task.team.toString(), 'task.completed', serializeTask(task));
  }

  // Recurring task completed → spawn the next occurrence.
  if (parsed.data.status === 'done' && prevStatus !== 'done') {
    await spawnNextRecurrence(task, req.user!._id.toString());
  }

  sendSuccess(res, { task });
});

export const updateTaskPosition = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    position: z.number(),
    status: z.enum(['todo', 'in_progress', 'review', 'done']).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Valid position required.');

  const task = await Task.findById(req.params.taskId);
  if (!task) throw new ApiError(404, 'Task not found.');

  {
    const uid = req.user!._id.toString();
    const team = await verifyTeamMember(task.team.toString(), uid);
    assertCanEditTask(team, uid, task);
  }

  task.position = parsed.data.position;
  if (parsed.data.status) task.status = parsed.data.status;
  await task.save();

  sendSuccess(res, { task });
});

export const deleteTask = asyncHandler(async (req: Request, res: Response) => {
  const task = await Task.findById(req.params.taskId);
  if (!task) throw new ApiError(404, 'Task not found.');

  const userId = req.user!._id.toString();
  const team = await verifyTeamMember(task.team.toString(), userId);
  assertCanDeleteTask(team, userId, task);

  const teamId = task.team.toString();
  const taskId = task._id.toString();
  const snapshot = serializeTask(task);
  await task.deleteOne();

  const io = getIO();
  if (io) {
    io.to(`team:${teamId}`).emit('task:deleted', { taskId, teamId });
  }
  deliverIntegrations(teamId, 'task.deleted', snapshot);
  logActivity({
    teamId,
    actorId: userId,
    action: 'task.deleted',
    target: { type: 'task', id: taskId, label: `#${task.identifier} ${task.title}` },
  });

  sendSuccess(res, null, 'Task deleted.');
});

/* ── Kanban position rebalance ───────────────────────────────────────────── */

export const rebalancePositions = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    teamId: z.string(),
    status: z.enum(['todo', 'in_progress', 'review', 'done']),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  await verifyTeamMember(parsed.data.teamId, req.user!._id.toString());

  const tasks = await Task.find({
    team: parsed.data.teamId,
    status: parsed.data.status,
    isArchived: false,
  }).sort({ position: 1 }).select('_id position');

  const updates = tasks.map((t, i) =>
    Task.updateOne({ _id: t._id }, { $set: { position: (i + 1) * 1000 } })
  );
  await Promise.all(updates);

  sendSuccess(res, null, 'Positions rebalanced.');
});

/* ── Bulk task actions ───────────────────────────────────────────────────── */

export const bulkUpdateTasks = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    taskIds: z.array(z.string()).min(1).max(100),
    teamId: z.string(),
    changes: z.object({
      status: z.enum(['todo', 'in_progress', 'review', 'done']).optional(),
      priority: z.enum(['urgent', 'high', 'medium', 'low']).optional(),
      assignees: z.array(z.string()).optional(),
      isArchived: z.boolean().optional(),
    }),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const userId = req.user!._id.toString();
  const bulkTeam = await verifyTeamMember(parsed.data.teamId, userId);
  assertPermission(bulkTeam, userId, 'editAnyTask', "You don't have permission to bulk-edit tasks.");

  const updateFields: Record<string, unknown> = {};
  if (parsed.data.changes.status) updateFields.status = parsed.data.changes.status;
  if (parsed.data.changes.priority) updateFields.priority = parsed.data.changes.priority;
  if (parsed.data.changes.assignees) updateFields.assignees = parsed.data.changes.assignees;
  if (parsed.data.changes.isArchived !== undefined) updateFields.isArchived = parsed.data.changes.isArchived;
  if (parsed.data.changes.status === 'done') updateFields.completedAt = new Date();

  await Task.updateMany(
    { _id: { $in: parsed.data.taskIds }, team: parsed.data.teamId },
    { $set: updateFields }
  );

  // Pre-populate assignees once if changed (same list for all tasks in bulk)
  let populatedAssignees: unknown[] | undefined;
  if (parsed.data.changes.assignees) {
    populatedAssignees = await User.find(
      { _id: { $in: parsed.data.changes.assignees } },
      'name avatar'
    );
  }

  const io = getIO();
  if (io) {
    const socketChanges: Record<string, unknown> = { ...parsed.data.changes };
    if (populatedAssignees !== undefined) socketChanges.assignees = populatedAssignees;
    for (const taskId of parsed.data.taskIds) {
      io.to(`team:${parsed.data.teamId}`).emit('task:updated', {
        taskId,
        changes: socketChanges,
      });
    }
  }

  sendSuccess(res, { updated: parsed.data.taskIds.length }, 'Tasks updated.');
});

export const bulkDeleteTasks = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    taskIds: z.array(z.string()).min(1).max(100),
    teamId: z.string(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const userId = req.user!._id.toString();
  const team = await verifyTeamMember(parsed.data.teamId, userId);

  const canDeleteAny = hasPermission(team, userId, 'deleteAnyTask');
  const canDeleteOwn = hasPermission(team, userId, 'deleteOwnTask');
  if (!canDeleteAny && !canDeleteOwn) {
    throw new ApiError(403, "You don't have permission to delete tasks.", {
      code: 'PERMISSION_DENIED',
      details: { permission: 'deleteTask' },
    });
  }

  const filter = canDeleteAny
    ? { _id: { $in: parsed.data.taskIds }, team: parsed.data.teamId }
    : { _id: { $in: parsed.data.taskIds }, team: parsed.data.teamId, createdBy: userId };

  const tasks = await Task.find(filter).select('_id');
  const deletableIds = tasks.map((t) => t._id.toString());

  await Task.deleteMany({ _id: { $in: deletableIds } });

  const io = getIO();
  if (io) {
    for (const taskId of deletableIds) {
      io.to(`team:${parsed.data.teamId}`).emit('task:deleted', {
        taskId,
        teamId: parsed.data.teamId,
      });
    }
  }

  sendSuccess(res, { deleted: deletableIds.length }, 'Tasks deleted.');
});
