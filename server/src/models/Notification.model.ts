import mongoose, { Schema, Document } from 'mongoose';

export type NotificationType =
  | 'task_assigned'
  | 'task_updated'
  | 'task_completed'
  | 'task_due_soon'
  | 'task_overdue'
  | 'team_invite'
  | 'member_joined'
  | 'mention';

export interface INotification extends Document {
  _id: mongoose.Types.ObjectId;
  recipient: mongoose.Types.ObjectId;
  actor: mongoose.Types.ObjectId;
  type: NotificationType;
  task: mongoose.Types.ObjectId | null;
  team: mongoose.Types.ObjectId | null;
  message: string;
  isRead: boolean;
  readAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: [
        'task_assigned',
        'task_updated',
        'task_completed',
        'task_due_soon',
        'task_overdue',
        'team_invite',
        'member_joined',
        'mention',
      ],
      required: true,
    },
    task: { type: Schema.Types.ObjectId, ref: 'Task', default: null },
    team: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
    message: { type: String, required: true, maxlength: 300 },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

NotificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ recipient: 1, createdAt: -1 });
// TTL: auto-delete after 90 days
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
