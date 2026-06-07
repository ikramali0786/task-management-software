import mongoose, { Schema, Document } from 'mongoose';

/** Supported custom field value types. */
export const CUSTOM_FIELD_TYPES = ['text', 'number', 'select', 'date', 'checkbox'] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

/**
 * A team-defined custom field that appears on every task in the team. Values are
 * stored per-task in `Task.customFields` keyed by this definition's id.
 */
export interface ICustomField extends Document {
  _id: mongoose.Types.ObjectId;
  team: mongoose.Types.ObjectId;
  name: string;
  type: CustomFieldType;
  options: string[];      // choices for 'select'
  order: number;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CustomFieldSchema = new Schema<ICustomField>(
  {
    team: { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    type: { type: String, enum: CUSTOM_FIELD_TYPES, required: true },
    options: { type: [String], default: [] },
    order: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const CustomField = mongoose.model<ICustomField>('CustomField', CustomFieldSchema);
