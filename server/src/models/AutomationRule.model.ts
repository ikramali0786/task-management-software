import mongoose, { Schema, Document } from 'mongoose';

/** Events that can trigger a rule. */
export const AUTOMATION_TRIGGERS = ['task.created', 'task.updated', 'task.completed'] as const;
export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number];

/** Condition fields (all conditions must match — logical AND). */
export const CONDITION_FIELDS = ['priority', 'status', 'titleContains', 'unassigned'] as const;
export type ConditionField = (typeof CONDITION_FIELDS)[number];

/** Action types a rule can perform on the triggering task. */
export const ACTION_TYPES = [
  'setPriority', 'setStatus', 'addLabel', 'assignTo', 'setDueInDays', 'addComment',
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export interface IAutomationCondition {
  field: ConditionField;
  value: any;
}
export interface IAutomationAction {
  type: ActionType;
  value: any;
}

export interface IAutomationRule extends Document {
  _id: mongoose.Types.ObjectId;
  team: mongoose.Types.ObjectId;
  name: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  conditions: IAutomationCondition[];
  actions: IAutomationAction[];
  createdBy: mongoose.Types.ObjectId;
  lastRunAt: Date | null;
  runCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const AutomationRuleSchema = new Schema<IAutomationRule>(
  {
    team: { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    enabled: { type: Boolean, default: true },
    trigger: { type: String, enum: AUTOMATION_TRIGGERS, required: true },
    conditions: { type: [{ field: String, value: Schema.Types.Mixed }], default: [] },
    actions: { type: [{ type: { type: String }, value: Schema.Types.Mixed }], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lastRunAt: { type: Date, default: null },
    runCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const AutomationRule = mongoose.model<IAutomationRule>('AutomationRule', AutomationRuleSchema);
