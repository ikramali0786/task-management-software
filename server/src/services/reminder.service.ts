import { Task } from '../models/Task.model';
import { env } from '../config/env';
import logger, { audit } from '../utils/logger';
import { createNotification } from './notification.service';
import { isEmailConfigured, sendDueReminderEmail } from './email.service';

// ── Due-date reminder scheduler ──────────────────────────────────────────────
// Runs in-process (no extra worker/Render service). On each tick it:
//   1. Finds tasks due within the next DUE_SOON_WINDOW and not yet reminded,
//      sends a "due soon" notification (+ email) to each assignee.
//   2. Finds overdue, still-open tasks not yet alerted, sends an "overdue"
//      notification (+ email).
// Per-task flags (reminderSentAt / overdueSentAt) make each tick idempotent, so
// duplicate emails are never sent even if the process restarts. Editing a
// task's due date clears the flags (see task.controller.ts) so it re-notifies.

const SCAN_INTERVAL_MS = 15 * 60 * 1000;   // every 15 minutes
const DUE_SOON_WINDOW_MS = 24 * 60 * 60 * 1000;
const OPEN_STATUSES = ['todo', 'in_progress', 'review'];

const clientBase = env.CLIENT_URL.replace(/\/$/, '');
const taskUrl = () => `${clientBase}/my-tasks`;

const formatDue = (due: Date): string => {
  const diffMs = due.getTime() - Date.now();
  if (diffMs <= 0) return 'now';
  const hours = Math.round(diffMs / (60 * 60 * 1000));
  if (hours < 1) return 'in under an hour';
  if (hours < 24) return `in ${hours} hour${hours === 1 ? '' : 's'}`;
  return `on ${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
};

type PopulatedTask = {
  _id: any;
  title: string;
  dueDate: Date;
  team: { _id: any; name: string } | null;
  createdBy: any;
  assignees: Array<{ _id: any; name: string; email?: string }>;
};

const notifyAssignees = async (task: PopulatedTask, overdue: boolean) => {
  const teamName = task.team?.name || 'your team';
  const dueLabel = formatDue(new Date(task.dueDate));
  const message = overdue
    ? `"${task.title}" is overdue`
    : `"${task.title}" is due ${dueLabel}`;

  for (const assignee of task.assignees) {
    if (!assignee?._id) continue;
    try {
      await createNotification({
        recipientId: String(assignee._id),
        actorId: String(task.createdBy || assignee._id),
        type: overdue ? 'task_overdue' : 'task_due_soon',
        taskId: String(task._id),
        teamId: task.team ? String(task.team._id) : undefined,
        message,
      });
    } catch (err: any) {
      logger.warn(`[reminder] notification failed for task ${task._id}: ${err?.message}`);
    }

    if (isEmailConfigured() && assignee.email) {
      try {
        await sendDueReminderEmail(
          assignee.email,
          assignee.name,
          task.title,
          teamName,
          dueLabel,
          taskUrl(),
          overdue
        );
      } catch {
        /* email failure already audited inside the email service */
      }
    }
  }
};

export const runReminderScan = async (): Promise<void> => {
  const now = new Date();
  const soonCutoff = new Date(now.getTime() + DUE_SOON_WINDOW_MS);

  try {
    // 1. Due soon (dueDate between now and +24h)
    const dueSoon = (await Task.find({
      isArchived: false,
      status: { $in: OPEN_STATUSES },
      reminderSentAt: null,
      dueDate: { $gte: now, $lte: soonCutoff },
    })
      .populate('team', 'name')
      .populate('assignees', 'name email')
      .lean()) as unknown as PopulatedTask[];

    for (const task of dueSoon) {
      await notifyAssignees(task, false);
      await Task.updateOne({ _id: task._id }, { reminderSentAt: new Date() });
    }

    // 2. Overdue (dueDate already passed, still open)
    const overdue = (await Task.find({
      isArchived: false,
      status: { $in: OPEN_STATUSES },
      overdueSentAt: null,
      dueDate: { $lt: now },
    })
      .populate('team', 'name')
      .populate('assignees', 'name email')
      .lean()) as unknown as PopulatedTask[];

    for (const task of overdue) {
      await notifyAssignees(task, true);
      await Task.updateOne({ _id: task._id }, { overdueSentAt: new Date() });
    }

    if (dueSoon.length || overdue.length) {
      audit('reminder.scan', { dueSoon: dueSoon.length, overdue: overdue.length });
    }
  } catch (err: any) {
    logger.error(`[reminder] scan failed: ${err?.message}`);
  }
};

let timer: NodeJS.Timeout | null = null;

export const startReminderScheduler = (): void => {
  if (timer) return;
  // First pass shortly after boot, then on a fixed interval.
  setTimeout(() => void runReminderScan(), 30 * 1000);
  timer = setInterval(() => void runReminderScan(), SCAN_INTERVAL_MS);
  logger.info(`[reminder] scheduler started (every ${SCAN_INTERVAL_MS / 60000} min)`);
};

export const stopReminderScheduler = (): void => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};
