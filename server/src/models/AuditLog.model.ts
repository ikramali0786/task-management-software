import mongoose, { Schema, Document } from 'mongoose';

/**
 * Team-scoped, append-only audit trail of meaningful actions (task lifecycle,
 * membership/role changes, billing, automation runs). Surfaced in the
 * Business-tier Audit Log. Distinct from the global security `audit()` logger.
 */
export interface IAuditLog extends Document {
  _id: mongoose.Types.ObjectId;
  team: mongoose.Types.ObjectId;
  actor: mongoose.Types.ObjectId | null;  // null = system
  action: string;                          // e.g. 'task.created', 'member.removed'
  target: { type?: string; id?: string; label?: string };
  meta: Record<string, unknown>;
  ip: string | null;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    team: { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    actor: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    action: { type: String, required: true },
    target: {
      type: { type: String },
      id: { type: String },
      label: { type: String },
    },
    meta: { type: Schema.Types.Mixed, default: {} },
    ip: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditLogSchema.index({ team: 1, createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
