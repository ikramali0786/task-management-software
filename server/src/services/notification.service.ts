import { Notification, NotificationType } from '../models/Notification.model';
import { getIO } from '../config/socket';

interface CreateNotificationInput {
  recipientId: string;
  actorId: string;
  type: NotificationType;
  taskId?: string;
  teamId?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export const createNotification = async (input: CreateNotificationInput) => {
  const notification = await Notification.create({
    recipient: input.recipientId,
    actor: input.actorId,
    type: input.type,
    task: input.taskId || null,
    team: input.teamId || null,
    message: input.message,
    metadata: input.metadata || {},
  });

  const populated = await notification.populate([
    { path: 'actor', select: 'name avatar' },
    { path: 'task', select: 'title' },
    { path: 'team', select: 'name' },
  ]);

  const io = getIO();
  if (io) {
    io.to(`user:${input.recipientId}`).emit('notification:new', { notification: populated });
  }

  return populated;
};
