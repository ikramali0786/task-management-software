import mongoose, { Schema, Document } from 'mongoose';

/**
 * A public intake form. Anyone with the link can submit a request, which becomes
 * a task in the owning team. No builder — a fixed, safe field set (name, email,
 * summary, details). Identified by an unguessable token.
 */
export interface IIntakeForm extends Document {
  _id: mongoose.Types.ObjectId;
  team: mongoose.Types.ObjectId;
  token: string;
  title: string;
  intro: string;
  defaultPriority: 'urgent' | 'high' | 'medium' | 'low';
  defaultStatus: 'todo' | 'in_progress' | 'review' | 'done';
  enabled: boolean;
  submissionCount: number;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const IntakeFormSchema = new Schema<IIntakeForm>(
  {
    team: { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    token: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    intro: { type: String, default: '', maxlength: 1000 },
    defaultPriority: { type: String, enum: ['urgent', 'high', 'medium', 'low'], default: 'medium' },
    defaultStatus: { type: String, enum: ['todo', 'in_progress', 'review', 'done'], default: 'todo' },
    enabled: { type: Boolean, default: true },
    submissionCount: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const IntakeForm = mongoose.model<IIntakeForm>('IntakeForm', IntakeFormSchema);
