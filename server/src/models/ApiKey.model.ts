import mongoose, { Schema, Document } from 'mongoose';

export interface IApiKey extends Omit<Document, 'model'> {
  _id: mongoose.Types.ObjectId;
  team: mongoose.Types.ObjectId;
  encryptedKey: string;
  iv: string;
  authTag: string;
  keyHint: string;   // e.g. "sk-...abcd"
  label: string;
  model: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ApiKeySchema = new Schema<IApiKey>(
  {
    team: { type: Schema.Types.ObjectId, ref: 'Team', required: true, unique: true },
    encryptedKey: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    keyHint: { type: String, required: true },
    label: { type: String, default: 'Team API Key', maxlength: 100 },
    model: { type: String, default: 'gpt-4o-mini' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const ApiKey = mongoose.model<IApiKey>('ApiKey', ApiKeySchema);
