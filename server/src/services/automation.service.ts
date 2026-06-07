import mongoose from 'mongoose';
import { AutomationRule, IAutomationCondition, IAutomationAction } from '../models/AutomationRule.model';
import { Task } from '../models/Task.model';
import { Comment } from '../models/Comment.model';
import { getIO } from '../config/socket';
import { sanitizeText } from '../utils/sanitize';
import logger from '../utils/logger';

/**
 * If-this-then-that automation engine. Runs from the single event fan-out
 * (deliverIntegrations) after a task change is persisted.
 *
 * Loop protection: actions mutate the task and emit a Socket.io `task:updated`
 * ONLY — they never re-enter the integration fan-out, so an automation's own
 * changes can't retrigger automations / webhooks / Slack.
 */

/** Evaluate a rule's conditions against a task (logical AND). Pure — exported for tests. */
export const evaluateConditions = (task: any, conditions: IAutomationCondition[]): boolean => {
  return conditions.every((c) => {
    switch (c.field) {
      case 'priority':
        return task.priority === c.value;
      case 'status':
        return task.status === c.value;
      case 'titleContains':
        return String(task.title || '').toLowerCase().includes(String(c.value || '').toLowerCase());
      case 'unassigned':
        return ((task.assignees?.length ?? 0) === 0) === Boolean(c.value);
      default:
        return false;
    }
  });
};

const PRIORITIES = ['urgent', 'high', 'medium', 'low'];
const STATUSES = ['todo', 'in_progress', 'review', 'done'];

/** Apply one rule's actions to a (mongoose) task doc. Returns the changed fields. */
const applyActions = async (
  task: any,
  actions: IAutomationAction[],
  ruleAuthor: mongoose.Types.ObjectId
): Promise<Record<string, unknown>> => {
  const changes: Record<string, unknown> = {};

  for (const a of actions) {
    switch (a.type) {
      case 'setPriority':
        if (PRIORITIES.includes(a.value) && task.priority !== a.value) {
          task.priority = a.value;
          changes.priority = a.value;
        }
        break;
      case 'setStatus':
        if (STATUSES.includes(a.value) && task.status !== a.value) {
          task.status = a.value;
          if (a.value === 'done' && !task.completedAt) task.completedAt = new Date();
          changes.status = a.value;
        }
        break;
      case 'addLabel': {
        const label = a.value || {};
        if (label.name && !(task.labels || []).some((l: any) => l.name === label.name)) {
          task.labels = [...(task.labels || []), { name: label.name, color: label.color || '#e8502e' }];
          changes.labels = task.labels;
        }
        break;
      }
      case 'assignTo': {
        const uid = String(a.value || '');
        if (mongoose.isValidObjectId(uid) && !(task.assignees || []).some((x: any) => x.toString() === uid)) {
          task.assignees = [...(task.assignees || []), new mongoose.Types.ObjectId(uid)];
          changes.assignees = task.assignees;
        }
        break;
      }
      case 'setDueInDays': {
        const n = Number(a.value);
        if (Number.isFinite(n)) {
          task.dueDate = new Date(Date.now() + n * 86_400_000);
          changes.dueDate = task.dueDate;
        }
        break;
      }
      case 'addComment': {
        const body = sanitizeText(String(a.value || '')).slice(0, 2000);
        if (body) {
          const comment = await Comment.create({ task: task._id, author: ruleAuthor, body });
          const populated = await comment.populate([{ path: 'author', select: 'name avatar username' }]);
          const io = getIO();
          if (io) {
            io.to(`team:${task.team}`).emit('comment:created', {
              comment: { ...populated.toObject(), replies: [] },
              taskId: task._id.toString(),
            });
          }
        }
        break;
      }
    }
  }

  return changes;
};

/**
 * Run all matching automation rules for a team event. Fire-and-forget; never throws.
 * Only task.* events carry a task id we can act on.
 */
export const runAutomations = async (teamId: string, event: string, data: any): Promise<void> => {
  try {
    if (!event.startsWith('task.') || !data?.id) return;

    const rules = await AutomationRule.find({ team: teamId, enabled: true, trigger: event });
    if (!rules.length) return;

    const task = await Task.findOne({ _id: data.id, team: teamId });
    if (!task) return;

    let anyChange = false;
    const allChanges: Record<string, unknown> = {};

    for (const rule of rules) {
      if (!evaluateConditions(task, rule.conditions)) continue;
      const changes = await applyActions(task, rule.actions, rule.createdBy);
      if (Object.keys(changes).length) {
        Object.assign(allChanges, changes);
        anyChange = true;
      }
      rule.lastRunAt = new Date();
      rule.runCount += 1;
      await rule.save();
    }

    if (anyChange) {
      await task.save();
      // Re-populate assignees so clients get full user objects (avatars).
      const populated = await task.populate([{ path: 'assignees', select: 'name avatar username' }]);
      if (allChanges.assignees) allChanges.assignees = (populated as any).assignees;
      const io = getIO();
      if (io) io.to(`team:${teamId}`).emit('task:updated', { taskId: task._id, changes: allChanges });
    }
  } catch (err: any) {
    logger.warn(`[automation] run failed for team ${teamId} event ${event}: ${err?.message}`);
  }
};
