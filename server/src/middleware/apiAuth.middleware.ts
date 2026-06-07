import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { AccessToken } from '../models/AccessToken.model';
import { Team } from '../models/Team.model';
import { PLAN_LIMITS } from '../config/plans';
import { effectivePlan } from '../utils/teamPlan';

export const TOKEN_PREFIX = 'tf_';

/** SHA-256 hex of a full token — what we store and compare against. */
export const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token, 'utf8').digest('hex');

/** Generate a fresh API token: `tf_<base64url>`. Returned to the caller once. */
export const generateApiToken = (): { token: string; prefix: string; last4: string; hash: string } => {
  const token = `${TOKEN_PREFIX}${crypto.randomBytes(24).toString('base64url')}`;
  return {
    token,
    prefix: token.slice(0, 7),       // e.g. "tf_AbCd"
    last4: token.slice(-4),
    hash: hashToken(token),
  };
};

/**
 * Authenticate a request to the public REST API (`/api/v1/*`) using a bearer
 * API token. On success, attaches `req.apiToken` and `req.apiTeam`. The owning
 * team's *effective* plan must include `apiAccess` (Pro+ / comp-premium).
 */
export const apiAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new ApiError(401, 'Missing API token. Pass it as `Authorization: Bearer <token>`.', {
      code: 'API_UNAUTHORIZED',
    });
  }
  const raw = header.slice(7).trim();
  if (!raw.startsWith(TOKEN_PREFIX)) {
    throw new ApiError(401, 'Invalid API token.', { code: 'API_UNAUTHORIZED' });
  }

  const token = await AccessToken.findOne({ tokenHash: hashToken(raw), revoked: false });
  if (!token) {
    throw new ApiError(401, 'Invalid or revoked API token.', { code: 'API_UNAUTHORIZED' });
  }
  if (token.expiresAt && token.expiresAt.getTime() < Date.now()) {
    throw new ApiError(401, 'This API token has expired.', { code: 'API_TOKEN_EXPIRED' });
  }

  const team = await Team.findById(token.team).populate('owner', 'email');
  if (!team) {
    throw new ApiError(401, 'The team for this token no longer exists.', { code: 'API_UNAUTHORIZED' });
  }

  // Gate the public API behind the plan feature (mirrors comp-premium handling).
  const plan = await effectivePlan(team);
  if (!PLAN_LIMITS[plan].features.apiAccess) {
    throw new ApiError(403, 'The API is available on the Pro and Business plans.', {
      code: 'PLAN_LIMIT',
      details: { feature: 'apiAccess', plan },
    });
  }

  req.apiToken = token;
  req.apiTeam = team;

  // Fire-and-forget last-used stamp (avoid a write on the hot path blocking the response).
  void AccessToken.updateOne({ _id: token._id }, { $set: { lastUsedAt: new Date() } }).catch(() => {});

  next();
});

/** Require a scope on the authenticated token (e.g. 'write' for mutations). */
export const requireScope = (scope: 'read' | 'write') =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.apiToken?.scopes.includes(scope)) {
      return next(
        new ApiError(403, `This token lacks the "${scope}" scope.`, { code: 'API_SCOPE_REQUIRED' })
      );
    }
    next();
  };
