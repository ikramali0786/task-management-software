import { User } from '../models/User.model';
import { env } from '../config/env';
import { sendTaskAssignedEmail, sendMentionEmail } from './email.service';

/**
 * Fire-and-forget email notifications for collaboration events. Each respects
 * the recipient's `emailNotifications` preference and never throws into the
 * request path (failures are swallowed; email.service already audits them).
 */

const taskUrl = () => `${env.CLIENT_URL.replace(/\/$/, '')}/my-tasks`;

/** Email everyone newly assigned to a task (excluding the actor). */
export const emailTaskAssigned = async (
  recipientIds: string[],
  assignedBy: string,
  taskTitle: string,
  teamName: string
): Promise<void> => {
  const ids = [...new Set(recipientIds)].filter(Boolean);
  if (!ids.length) return;
  try {
    const users = await User.find({
      _id: { $in: ids },
      emailNotifications: { $ne: false },
    }).select('name email');
    for (const u of users) {
      sendTaskAssignedEmail(u.email, u.name, {
        taskTitle,
        teamName,
        assignedBy,
        url: taskUrl(),
      }).catch(() => {});
    }
  } catch {
    /* never block the request */
  }
};

/** Email a user who was @mentioned in a comment. */
export const emailMention = async (
  recipientId: string,
  byName: string,
  taskTitle: string,
  teamName: string
): Promise<void> => {
  if (!recipientId) return;
  try {
    const u = await User.findOne({
      _id: recipientId,
      emailNotifications: { $ne: false },
    }).select('name email');
    if (u) {
      await sendMentionEmail(u.email, u.name, { taskTitle, teamName, byName, url: taskUrl() }).catch(
        () => {}
      );
    }
  } catch {
    /* never block the request */
  }
};
