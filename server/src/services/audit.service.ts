import { AuditLog } from '../models/AuditLog.model';
import logger from '../utils/logger';

interface LogActivityInput {
  teamId: string;
  actorId?: string | null;
  action: string;
  target?: { type?: string; id?: string; label?: string };
  meta?: Record<string, unknown>;
  ip?: string | null;
}

/**
 * Append a team-scoped audit entry. Fire-and-forget — call as a plain statement;
 * never throws and never blocks the request path.
 */
export const logActivity = (input: LogActivityInput): void => {
  void AuditLog.create({
    team: input.teamId,
    actor: input.actorId || null,
    action: input.action,
    target: input.target || {},
    meta: input.meta || {},
    ip: input.ip || null,
  }).catch((err) => logger.warn(`[audit] persist failed: ${err?.message}`));
};
