import mongoose, { Schema, Document } from 'mongoose';

/** Events a webhook can subscribe to. '*' (stored as the literal) = all events. */
export const WEBHOOK_EVENTS = [
  'task.created',
  'task.updated',
  'task.completed',
  'task.deleted',
  'comment.created',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/**
 * Outbound webhook endpoint. On each subscribed event, the server POSTs a
 * JSON payload signed with HMAC-SHA256 (header `X-TaskFlow-Signature`). The
 * `secret` is shared with the integrator so they can verify authenticity.
 */
export interface IWebhook extends Document {
  _id: mongoose.Types.ObjectId;
  team: mongoose.Types.ObjectId;
  url: string;
  secret: string;             // shared HMAC secret (whsec_…)
  events: string[];           // subscribed event names, or ['*'] for all
  enabled: boolean;
  createdBy: mongoose.Types.ObjectId;
  lastDeliveryAt: Date | null;
  lastStatus: number | null;  // last HTTP status code received (or 0 on network error)
  failureCount: number;       // consecutive failures — auto-disables at threshold
  disabledReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const WebhookSchema = new Schema<IWebhook>(
  {
    team: { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    url: { type: String, required: true, maxlength: 2000 },
    secret: { type: String, required: true },
    events: { type: [String], default: ['*'] },
    enabled: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lastDeliveryAt: { type: Date, default: null },
    lastStatus: { type: Number, default: null },
    failureCount: { type: Number, default: 0 },
    disabledReason: { type: String, default: null },
  },
  { timestamps: true }
);

export const Webhook = mongoose.model<IWebhook>('Webhook', WebhookSchema);
