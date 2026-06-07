import mongoose, { Schema, Document } from 'mongoose';

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';
export type RecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'monthly';

export interface IRecurrence {
  frequency: RecurrenceFrequency;
  interval: number;   // every N days/weeks/months (default 1)
  endDate: Date | null; // stop recurring after this date (null = forever)
}

export interface ISubtask {
  _id: mongoose.Types.ObjectId;
  title: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITimeEntry {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  minutes: number;       // logged duration in minutes
  note: string;
  loggedAt: Date;
}

export interface ITask extends Document {
  _id: mongoose.Types.ObjectId;
  identifier: number;      // per-team sequential ID, e.g. #1, #2, #3
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
  reminderSentAt: Date | null;   // when a "due soon" reminder was last sent
  overdueSentAt: Date | null;    // when an "overdue" alert was last sent
  recurrence: IRecurrence;       // auto-spawn the next instance on completion
  position: number;
  isArchived: boolean;
  subtasks: ISubtask[];
  timeEntries: ITimeEntry[];
  estimatedMinutes: number | null;
  blockedBy: mongoose.Types.ObjectId[];  // tasks that block this one
  blocks: mongoose.Types.ObjectId[];     // tasks this one blocks
  customFields: Record<string, unknown>; // team custom field values, keyed by field id
  embedding?: number[];                   // semantic-search vector (select:false)
  embeddingHash?: string | null;          // hash of the text the vector was built from
  createdAt: Date;
  updatedAt: Date;
}

const SubtaskSchema = new Schema<ISubtask>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    completed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const TimeEntrySchema = new Schema<ITimeEntry>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    minutes: { type: Number, required: true, min: 1 },
    note: { type: String, default: '', maxlength: 500 },
    loggedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const TaskSchema = new Schema<ITask>(
  {
    identifier: { type: Number },   // assigned on create via Team.taskCounter
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
        color: { type: String, default: '#e8502e' },
      },
    ],
    dueDate: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    reminderSentAt: { type: Date, default: null },
    overdueSentAt: { type: Date, default: null },
    recurrence: {
      frequency: {
        type: String,
        enum: ['none', 'daily', 'weekly', 'monthly'],
        default: 'none',
      },
      interval: { type: Number, default: 1, min: 1, max: 365 },
      endDate: { type: Date, default: null },
    },
    position: { type: Number, default: 0 },
    isArchived: { type: Boolean, default: false },
    subtasks: { type: [SubtaskSchema], default: [] },
    timeEntries: { type: [TimeEntrySchema], default: [] },
    estimatedMinutes: { type: Number, default: null },
    blockedBy: [{ type: Schema.Types.ObjectId, ref: 'Task', default: [] }],
    blocks:    [{ type: Schema.Types.ObjectId, ref: 'Task', default: [] }],
    customFields: { type: Schema.Types.Mixed, default: {} },
    // Semantic search — embedding vector + hash of the text it was built from
    // (so we know when it's stale). Excluded from normal queries.
    embedding: { type: [Number], select: false, default: undefined },
    embeddingHash: { type: String, select: false, default: null },
  },
  { timestamps: true }
);

TaskSchema.index({ team: 1, identifier: 1 }, { unique: true, sparse: true });
TaskSchema.index({ team: 1, status: 1 });
TaskSchema.index({ team: 1, status: 1, position: 1 });
TaskSchema.index({ assignees: 1 });
TaskSchema.index({ team: 1, dueDate: 1 });
TaskSchema.index({ team: 1, priority: 1 });
TaskSchema.index({ team: 1, isArchived: 1 });
TaskSchema.index({ title: 'text', description: 'text' });

export const Task = mongoose.model<ITask>('Task', TaskSchema);
