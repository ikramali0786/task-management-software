import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { ApiError } from './ApiError';

/**
 * Internal admin/support access control.
 *
 * Super-admins are an explicit env allowlist (SUPER_ADMIN_EMAILS), completely
 * separate from team roles and from comp-premium billing. Used to gate the
 * support panel under /api/admin and the /app/admin UI.
 */
const SUPER_ADMIN_EMAILS = new Set(
  env.SUPER_ADMIN_EMAILS.split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

export const isSuperAdmin = (email?: string | null): boolean =>
  !!email && SUPER_ADMIN_EMAILS.has(email.toLowerCase());

/** Express guard — 403 unless the authenticated user is a super-admin. */
export const requireSuperAdmin = (req: Request, _res: Response, next: NextFunction): void => {
  if (!isSuperAdmin(req.user?.email)) {
    throw new ApiError(403, 'Admin access required.', { code: 'ADMIN_REQUIRED' });
  }
  next();
};
