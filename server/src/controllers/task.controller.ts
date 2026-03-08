import { Request, Response } from 'express';
import { z } from 'zod';
import { Task, TaskStatus } from '../models/Task.model';
import { Team } from '../models/Team.model';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { createNotification } from '../services/notification.service';
import { getIO } from '../config/socket';
import { sanitizeText } from '../utils/sanitize';

const verifyTeamMember = async (teamId: string, userId: string) => {
  const team = await Team.findById(teamId);
  if (!team) throw new ApiError(404, 'Team not found.');
  const member = team.members.find((m) => m.user.toString() === userId);
  if (!member) throw new ApiError(403, 'Not a member of this team.');
  return team;
};

const getMaxPosition = async (teamId: string, status: TaskStatus): Promise<number> => {
  const last = await Task.findOne({ team: teamId, status, isArchived: false })
    .sort({ position: -1 })
    .select('position');
  return last ? last.position + 1000 : 1000;
};

export const createTask = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(5000).optional(),
    teamId: z.string(),
    assignees: z.array(z.string()).optional(),
    status: z.enum(['todo', 'in_progress', 'review', 'done']).optional(),
    priority: z.enum(['urgent', 'high', 'medium', 'low']).optional(),
    labels: z.array(z.object({ name: z.string(), color: z.string() })).optional(),
    dueDate: z.string().optional().nullable(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const userId = req.user!._id.toString();
  await verifyTeamMember(parsed.data.teamId, userId);

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
    dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
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

  // Notify assignees
  for (const assigneeId of (parsed.data.assignees || [])) {
    if (assigneeId !== userId) {
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
  }

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
      .populate('createdBy', 'name avatar'),
    Task.countDocuments(filter),
  ]);

  sendSuccess(res, { tasks, total, page: parseInt(page), limit: parseInt(limit) });
});

export const getTask = asyncHandler(async (req: Request, res: Response) => {
  const task = await Task.findById(req.params.taskId)
    .populate('assignees', 'name avatar email')
    .populate('createdBy', 'name avatar')
    .populate('team', 'name slug');

  if (!task) throw new ApiError(404, 'Task not found.');

  await verifyTeamMember(task.team._id.toString(), req.user!._id.toString());

  sendSuccess(res, { task });
});

export const updateTask = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(5000).optional(),
    assignees: z.array(z.string()).optional(),
    status: z.enum(['todo', 'in_progress', 'review', 'done']).optional(),
    priority: z.enum(['urgent', 'high', 'medium', 'low']).optional(),
    labels: z.array(z.object({ name: z.string(), color: z.string() })).optional(),
    dueDate: z.string().optional().nullable(),
    position: z.number().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const task = await Task.findById(req.params.taskId);
  if (!task) throw new ApiError(404, 'Task not found.');

  const userId = req.user!._id.toString();
  await verifyTeamMember(task.team.toString(), userId);

  const prevAssignees = task.assignees.map((a) => a.toString());
  const prevStatus = task.status;

  // Handle completedAt
  if (parsed.data.status === 'done' && task.status !== 'done') {
    (task as any).completedAt = new Date();
  } else if (parsed.data.status && parsed.data.status !== 'done') {
    (task as any).completedAt = null;
  }

  if (parsed.data.dueDate !== undefined) {
    task.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
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
    io.to(`team:${task.team}`).emit('task:updated', {
      taskId: task._id,
      changes: parsed.data,
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
  }

  sendSuccess(res, { task: populated });
});

export const updateTaskStatus = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({ status: z.enum(['todo', 'in_progress', 'review', 'done']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Valid status required.');

  const task = await Task.findById(req.params.taskId);
  if (!task) throw new ApiError(404, 'Task not found.');

  await verifyTeamMember(task.team.toString(), req.user!._id.toString());

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

  await verifyTeamMember(task.team.toString(), req.user!._id.toString());

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

  const isAdmin = team.members.find((m) => m.user.toString() === userId)?.role === 'admin';
  const isCreator = task.createdBy.toString() === userId;
  if (!isAdmin && !isCreator) throw new ApiError(403, 'Only the creator or admin can delete tasks.');

  const teamId = task.team.toString();
  const taskId = task._id.toString();
  await task.deleteOne();

  const io = getIO();
  if (io) {
    io.to(`team:${teamId}`).emit('task:deleted', { taskId, teamId });
  }

  sendSuccess(res, null, 'Task deleted.');
});

export const getWorkload = asyncHandler(async (req: Request, res: Response) => {
  const { teamId } = req.query as { teamId: string };
  if (!teamId) throw new ApiError(400, 'teamId is required.');

  await verifyTeamMember(teamId, req.user!._id.toString());

  const { Types } = require('mongoose');
  const teamOid = new Types.ObjectId(teamId);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [workload, completedTodayRaw, progressRaw] = await Promise.all([
    Task.aggregate([
      { $match: { team: teamOid, isArchived: false } },
      { $unwind: { path: '$assignees', preserveNullAndEmptyArrays: false } },
      { $group: { _id: { user: '$assignees', status: '$status' }, count: { $sum: 1 } } },
      {
        $group: {
          _id: '$_id.user',
          statusBreakdown: { $push: { status: '$_id.status', count: '$count' } },
          total: { $sum: '$count' },
        },
      },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $sort: { total: -1 } },
      { $project: { _id: 0, user: { _id: 1, name: 1, avatar: 1, email: 1, username: 1 }, total: 1, statusBreakdown: 1 } },
    ]),
    // Tasks completed today per assignee
    Task.aggregate([
      { $match: { team: teamOid, isArchived: false, status: 'done', completedAt: { $gte: todayStart, $lte: todayEnd } } },
      { $unwind: { path: '$assignees', preserveNullAndEmptyArrays: false } },
      { $group: { _id: '$assignees', count: { $sum: 1 } } },
    ]),
    // Overall progress (done / total)
    Task.aggregate([
      { $match: { team: teamOid, isArchived: false } },
      { $group: { _id: null, total: { $sum: 1 }, done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } } } },
    ]),
  ]);

  // Build map { userId -> completedToday }
  const completedTodayMap: Record<string, number> = {};
  for (const r of completedTodayRaw) {
    completedTodayMap[r._id.toString()] = r.count;
  }

  // Enrich workload with completedToday
  const enriched = workload.map((w: any) => ({
    ...w,
    completedToday: completedTodayMap[w.user._id.toString()] || 0,
  }));

  const projectProgress = progressRaw[0] || { total: 0, done: 0 };

  sendSuccess(res, { workload: enriched, projectProgress: { total: projectProgress.total, done: projectProgress.done } });
});

/* ── Subtask handlers ─────────────────────────────────────────────────────── */

export const reorderSubtasks = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({ subtaskIds: z.array(z.string()).min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const task = await Task.findById(req.params.taskId);
  if (!task) throw new ApiError(404, 'Task not found.');

  await verifyTeamMember(task.team.toString(), req.user!._id.toString());

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

  await verifyTeamMember(task.team.toString(), req.user!._id.toString());

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

  await verifyTeamMember(task.team.toString(), req.user!._id.toString());

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

  await verifyTeamMember(task.team.toString(), req.user!._id.toString());

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

export const getTaskStats = asyncHandler(async (req: Request, res: Response) => {
  const { teamId } = req.query as { teamId: string };
  if (!teamId) throw new ApiError(400, 'teamId is required.');

  await verifyTeamMember(teamId, req.user!._id.toString());

  const now = new Date();

  const [statusCounts, priorityCounts, overdue] = await Promise.all([
    Task.aggregate([
      { $match: { team: new (require('mongoose').Types.ObjectId)(teamId), isArchived: false } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Task.aggregate([
      { $match: { team: new (require('mongoose').Types.ObjectId)(teamId), isArchived: false } },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]),
    Task.countDocuments({
      team: teamId,
      isArchived: false,
      status: { $ne: 'done' },
      dueDate: { $lt: now },
    }),
  ]);

  const stats = {
    byStatus: statusCounts.reduce((acc: Record<string, number>, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {}),
    byPriority: priorityCounts.reduce((acc: Record<string, number>, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {}),
    overdue,
  };

  sendSuccess(res, { stats });
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
    }),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const userId = req.user!._id.toString();
  await verifyTeamMember(parsed.data.teamId, userId);

  const updateFields: Record<string, unknown> = {};
  if (parsed.data.changes.status) updateFields.status = parsed.data.changes.status;
  if (parsed.data.changes.priority) updateFields.priority = parsed.data.changes.priority;
  if (parsed.data.changes.assignees) updateFields.assignees = parsed.data.changes.assignees;
  if (parsed.data.changes.status === 'done') updateFields.completedAt = new Date();

  await Task.updateMany(
    { _id: { $in: parsed.data.taskIds }, team: parsed.data.teamId },
    { $set: updateFields }
  );

  const io = getIO();
  if (io) {
    for (const taskId of parsed.data.taskIds) {
      io.to(`team:${parsed.data.teamId}`).emit('task:updated', {
        taskId,
        changes: parsed.data.changes,
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

  const member = team.members.find((m) => m.user.toString() === userId);
  const isAdmin = member && ['owner', 'admin'].includes(member.role);

  const filter = isAdmin
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
  await verifyTeamMember(task.team.toString(), userId);

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

  await verifyTeamMember(task.team.toString(), req.user!._id.toString());

  (task as any).estimatedMinutes = parsed.data.estimatedMinutes;
  await task.save();

  sendSuccess(res, { estimatedMinutes: (task as any).estimatedMinutes });
});
