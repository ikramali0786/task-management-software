import mongoose, { Schema, Document } from 'mongoose';

/**
 * A reusable task blueprint. Members spin up new tasks from a template instead
 * of retyping the same title/description/checklist each time.
 */
export interface ITaskTemplate extends Document {
  _id: mongoose.Types.ObjectId;
  team: mongoose.Types.ObjectId;
  name: string;               // template label, e.g. "Bug report"
  title: string;              // default task title
  description: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: 'todo' | 'in_progress' | 'review' | 'done';
  labels: Array<{ name: string; color: string }>;
  estimatedMinutes: number | null;
  subtasks: string[];         // checklist item titles
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TaskTemplateSchema = new Schema<ITaskTemplate>(
  {
    team: { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 5000 },
    priority: { type: String, enum: ['urgent', 'high', 'medium', 'low'], default: 'medium' },
    status: { type: String, enum: ['todo', 'in_progress', 'review', 'done'], default: 'todo' },
    labels: [
      {
        name: { type: String, required: true },
        color: { type: String, default: '#e8502e' },
      },
    ],
    estimatedMinutes: { type: Number, default: null },
    subtasks: { type: [String], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const TaskTemplate = mongoose.model<ITaskTemplate>('TaskTemplate', TaskTemplateSchema);
