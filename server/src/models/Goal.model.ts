import mongoose, { Schema, Document } from 'mongoose';

export const GOAL_STATUSES = ['on_track', 'at_risk', 'off_track', 'achieved'] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export interface IKeyResult {
  _id: mongoose.Types.ObjectId;
  title: string;
  current: number;
  target: number;
  unit: string;
}

/**
 * A team objective (OKR). Progress is derived from its key results: each KR's
 * completion is current/target (capped at 100%), and the objective's progress is
 * the average across its KRs.
 */
export interface IGoal extends Document {
  _id: mongoose.Types.ObjectId;
  team: mongoose.Types.ObjectId;
  title: string;
  description: string;
  owner: mongoose.Types.ObjectId | null;
  status: GoalStatus;
  dueDate: Date | null;
  keyResults: IKeyResult[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const KeyResultSchema = new Schema<IKeyResult>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    current: { type: Number, default: 0 },
    target: { type: Number, default: 100 },
    unit: { type: String, default: '', maxlength: 20 },
  },
  { _id: true }
);

const GoalSchema = new Schema<IGoal>(
  {
    team: { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 2000 },
    owner: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    status: { type: String, enum: GOAL_STATUSES, default: 'on_track' },
    dueDate: { type: Date, default: null },
    keyResults: { type: [KeyResultSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const Goal = mongoose.model<IGoal>('Goal', GoalSchema);
