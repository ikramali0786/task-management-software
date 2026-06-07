import { Request, Response } from 'express';
import { AuditLog } from '../models/AuditLog.model';
import { Team } from '../models/Team.model';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { assertPermission } from '../utils/permissions';
import { assertFeature } from '../utils/teamPlan';

/* GET /audit?teamId=…&page=&limit=&action= — Business-tier audit trail. */
export const listAuditLog = asyncHandler(async (req: Request, res: Response) => {
  const { teamId, action } = req.query as Record<string, string>;
  if (!teamId) throw new ApiError(400, 'teamId is required.');

  const team = await Team.findById(teamId);
  if (!team) throw new ApiError(404, 'Team not found.');
  assertPermission(team, req.user!._id.toString(), 'manageTeamSettings', 'Only team admins can view the audit log.');
  await assertFeature(team, 'auditLog', req.user!.email);

  const page = Math.max(1, parseInt((req.query.page as string) || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '40', 10) || 40));

  const filter: Record<string, unknown> = { team: teamId };
  if (action) filter.action = action;

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('actor', 'name avatar email'),
    AuditLog.countDocuments(filter),
  ]);

  sendSuccess(res, {
    logs: logs.map((l: any) => ({
      id: l._id.toString(),
      action: l.action,
      actor: l.actor ? { id: l.actor._id.toString(), name: l.actor.name, avatar: l.actor.avatar } : null,
      target: l.target || {},
      meta: l.meta || {},
      createdAt: l.createdAt,
    })),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
});
