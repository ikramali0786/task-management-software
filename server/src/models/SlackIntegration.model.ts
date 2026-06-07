import mongoose, { Schema, Document } from 'mongoose';

/**
 * Per-team Slack connection via an Incoming Webhook URL. When connected, the
 * server posts a formatted message to the chosen Slack channel on subscribed
 * task/comment events. One integration per team.
 *
 * The webhook URL is a secret (anyone holding it can post to the channel), so it
 * is never returned to the client in full — only a masked hint.
 */
export interface ISlackIntegration extends Document {
  _id: mongoose.Types.ObjectId;
  team: mongoose.Types.ObjectId;
  webhookUrl: string;
  events: string[];           // subscribed event names, or ['*'] for all
  enabled: boolean;
  createdBy: mongoose.Types.ObjectId;
  lastDeliveryAt: Date | null;
  lastStatus: number | null;
  failureCount: number;
  disabledReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const SlackIntegrationSchema = new Schema<ISlackIntegration>(
  {
    team: { type: Schema.Types.ObjectId, ref: 'Team', required: true, unique: true },
    webhookUrl: { type: String, required: true },
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

export const SlackIntegration = mongoose.model<ISlackIntegration>('SlackIntegration', SlackIntegrationSchema);
