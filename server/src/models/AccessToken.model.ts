import mongoose, { Schema, Document } from 'mongoose';

/**
 * Developer API token (a.k.a. Personal/Team Access Token).
 *
 * NOTE: distinct from `ApiKey` — that model stores a team's *OpenAI* key for the
 * AI chatbots. This model authenticates external callers against TaskFlow's own
 * public REST API (`/api/v1/*`).
 *
 * Security: we never store the plaintext token. The caller sees it exactly once
 * at creation time; we persist only its SHA-256 hash plus a display prefix and
 * last-4 so the UI can identify it.
 */
export interface IAccessToken extends Document {
  _id: mongoose.Types.ObjectId;
  team: mongoose.Types.ObjectId;
  name: string;
  tokenHash: string;          // sha256(hex) of the full token
  prefix: string;             // e.g. "tf_AbCd" — shown in the UI
  last4: string;              // last 4 chars of the token
  scopes: ('read' | 'write')[];
  createdBy: mongoose.Types.ObjectId;
  lastUsedAt: Date | null;
  expiresAt: Date | null;     // null = never expires
  revoked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AccessTokenSchema = new Schema<IAccessToken>(
  {
    team: { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    tokenHash: { type: String, required: true, unique: true, index: true },
    prefix: { type: String, required: true },
    last4: { type: String, required: true },
    scopes: {
      type: [String],
      enum: ['read', 'write'],
      default: ['read', 'write'],
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lastUsedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    revoked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const AccessToken = mongoose.model<IAccessToken>('AccessToken', AccessTokenSchema);
