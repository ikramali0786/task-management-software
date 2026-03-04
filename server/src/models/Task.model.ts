import mongoose, { Schema, Document } from 'mongoose';

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';

export interface ITask extends Document {
  _id: string;
  title: string;
  description: string;
  team: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  assignees: mongoose.Types.ObjectId[];
  status: TaskStatus;
  priority: TaskPriority;
  labels: Array<{ name: string; color: string }>;
  dueDate: Date | null;
  completedAt: Date | null;
  position: number;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 5000 },
    team: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignees: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    status: {
      type: String,
      enum: ['todo', 'in_progress', 'review', 'done'],
      default: 'todo',
    },
    priority: {
      type: String,
      enum: ['urgent', 'high', 'medium', 'low'],
      default: 'medium',
    },
    labels: [
      {
        name: { type: String, required: true },
        color: { type: String, default: '#6366f1' },
      },
    ],
    dueDate: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    position: { type: Number, default: 0 },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

TaskSchema.index({ team: 1, status: 1 });
TaskSchema.index({ team: 1, status: 1, position: 1 });
TaskSchema.index({ assignees: 1 });
TaskSchema.index({ team: 1, dueDate: 1 });
TaskSchema.index({ team: 1, priority: 1 });
TaskSchema.index({ team: 1, isArchived: 1 });
TaskSchema.index({ title: 'text', description: 'text' });

export const Task = mongoose.model<ITask>('Task', TaskSchema);
