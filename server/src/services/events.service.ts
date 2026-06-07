import { getIO } from '../config/socket';
import { dispatchWebhookEvent } from './webhook.service';
import { serializeTask } from '../utils/serializeTask';

/**
 * Fan-out for task lifecycle events: notify connected clients via Socket.io
 * AND deliver to any subscribed outbound webhooks. Used by the public REST API
 * controllers so an API-driven change updates the live UI and fires webhooks
 * exactly like an in-app change does.
 */

export const emitTaskCreated = (teamId: string, task: any) => {
  const io = getIO();
  if (io) io.to(`team:${teamId}`).emit('task:created', { task });
  void dispatchWebhookEvent(teamId, 'task.created', serializeTask(task));
};

export const emitTaskUpdated = (teamId: string, task: any, opts: { completed?: boolean } = {}) => {
  const io = getIO();
  if (io) io.to(`team:${teamId}`).emit('task:updated', { task });
  void dispatchWebhookEvent(teamId, 'task.updated', serializeTask(task));
  if (opts.completed) void dispatchWebhookEvent(teamId, 'task.completed', serializeTask(task));
};

export const emitTaskDeleted = (teamId: string, taskId: string, task?: any) => {
  const io = getIO();
  if (io) io.to(`team:${teamId}`).emit('task:deleted', { taskId, teamId });
  void dispatchWebhookEvent(teamId, 'task.deleted', task ? serializeTask(task) : { id: taskId, team: teamId });
};
