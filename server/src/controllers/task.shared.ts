import { z } from 'zod';
import { Task, TaskStatus } from '../models/Task.model';
import { Team } from '../models/Team.model';
import { ApiError } from '../utils/ApiError';
import { getIO } from '../config/socket';

/**
 * Shared helpers + schemas for the task controllers.
 *
 * The task surface is large enough that its handlers live in several focused
 * controller files (core CRUD, items, analytics, export). These helpers are
 * the pieces more than one of them needs.
 */

/** Resolve a team and assert the user is a member, else 403/404. */
export const verifyTeamMember = async (teamId: string, userId: string) => {
  const team = await Team.findById(teamId);
  if (!team) throw new ApiError(404, 'Team not found.');
  const member = team.members.find((m) => m.user.toString() === userId);
  if (!member) throw new ApiError(403, 'Not a member of this team.');
  return team;
};

/** Next position at the end of a status column (1000-spaced for midpoint moves). */
export const getMaxPosition = async (teamId: string, status: TaskStatus): Promise<number> => {
  const last = await Task.findOne({ team: teamId, status, isArchived: false })
    .sort({ position: -1 })
    .select('position');
  return last ? last.position + 1000 : 1000;
};

// Zod shape for an optional recurrence rule, reused by create + update.
export const recurrenceSchema = z
  .object({
    frequency: z.enum(['none', 'daily', 'weekly', 'monthly']),
    interval: z.number().int().min(1).max(365).optional(),
    endDate: z.string().nullable().optional(),
  })
  .optional();

const advanceDate = (from: Date, frequency: string, interval: number): Date => {
  const d = new Date(from);
  const n = Math.max(1, interval);
  if (frequency === 'daily') d.setDate(d.getDate() + n);
  else if (frequency === 'weekly') d.setDate(d.getDate() + 7 * n);
  else if (frequency === 'monthly') d.setMonth(d.getMonth() + n);
  return d;
};

// When a recurring task is completed, spawn a fresh "todo" instance with the due
// date advanced by its interval. The recurrence rule is transferred to the new
// instance and cleared on the completed one, so toggling done↔todo never spawns
// duplicates — only a genuine completion of the live instance recurs.
export const spawnNextRecurrence = async (task: any, userId: string): Promise<void> => {
  const rec = task.recurrence;
  if (!rec || rec.frequency === 'none') return;

  const interval = rec.interval || 1;
  const base = task.dueDate ? new Date(task.dueDate) : new Date();
  const nextDue = advanceDate(base, rec.frequency, interval);

  // Stop recurring once the next occurrence would fall after the end date.
  if (rec.endDate && nextDue > new Date(rec.endDate)) {
    task.recurrence = { frequency: 'none', interval: 1, endDate: null };
    await task.save();
    return;
  }

  const position = await getMaxPosition(task.team.toString(), 'todo');
  const updatedTeam = await Team.findByIdAndUpdate(
    task.team,
    { $inc: { taskCounter: 1 } },
    { new: true, select: 'taskCounter' }
  );
  const identifier = updatedTeam?.taskCounter ?? 1;

  const next = await Task.create({
    identifier,
    title: task.title,
    description: task.description,
    team: task.team,
    createdBy: userId,
    assignees: task.assignees,
    status: 'todo',
    priority: task.priority,
    labels: task.labels,
    dueDate: nextDue,
    position,
    recurrence: { frequency: rec.frequency, interval, endDate: rec.endDate ?? null },
  });

  // The completed task no longer recurs — the new instance carries it forward.
  task.recurrence = { frequency: 'none', interval: 1, endDate: null };
  await task.save();

  const populated = await next.populate([
    { path: 'assignees', select: 'name avatar' },
    { path: 'createdBy', select: 'name avatar' },
  ]);

  const io = getIO();
  if (io) io.to(`team:${task.team}`).emit('task:created', { task: populated });
};
