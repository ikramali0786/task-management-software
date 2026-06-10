import { Schema, model, Document } from 'mongoose';

/**
 * Stripe webhook idempotency ledger.
 *
 * Stripe retries webhook deliveries (and can deliver the same event more than
 * once). Each event ID is recorded here with a unique index before its side
 * effects run — a duplicate insert fails with E11000 and the handler ACKs
 * without re-processing. Rows expire after 30 days (Stripe stops retrying
 * long before that), so the collection stays tiny.
 */
export interface IProcessedStripeEvent extends Document {
  eventId: string;
  type: string;
  receivedAt: Date;
}

const processedStripeEventSchema = new Schema<IProcessedStripeEvent>({
  eventId: { type: String, required: true, unique: true },
  type: { type: String, required: true },
  receivedAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 }, // TTL: 30 days
});

export const ProcessedStripeEvent = model<IProcessedStripeEvent>(
  'ProcessedStripeEvent',
  processedStripeEventSchema
);
