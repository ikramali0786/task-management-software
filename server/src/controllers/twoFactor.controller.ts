import crypto from 'crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { User } from '../models/User.model';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { audit } from '../utils/logger';
import { encrypt, decrypt } from '../utils/encrypt';
import { verify2faChallengeToken } from '../services/auth.service';
import { issueSession } from './auth.controller';

const ISSUER = 'TaskFlow';

// ── secret encryption helpers (AES-GCM via ENCRYPTION_SECRET) ────────────────
const sealSecret = (secret: string): string => JSON.stringify(encrypt(secret));
const openSecret = (sealed: string): string => decrypt(JSON.parse(sealed));

const requireEncryption = () => {
  if (!process.env.ENCRYPTION_SECRET) {
    throw new ApiError(500, 'Server misconfiguration: ENCRYPTION_SECRET is not set. Add it in your hosting environment and redeploy.');
  }
};

// ── recovery codes ───────────────────────────────────────────────────────────
const normalizeCode = (c: string) => c.replace(/[^a-z0-9]/gi, '').toLowerCase();
const hashCode = (c: string) => crypto.createHash('sha256').update(normalizeCode(c)).digest('hex');

const generateRecoveryCodes = (n = 10): { plain: string[]; hashes: string[] } => {
  const plain: string[] = [];
  const hashes: string[] = [];
  for (let i = 0; i < n; i++) {
    const raw = crypto.randomBytes(5).toString('hex'); // 10 hex chars
    const code = `${raw.slice(0, 5)}-${raw.slice(5)}`;
    plain.push(code);
    hashes.push(hashCode(code));
  }
  return { plain, hashes };
};

/* ── POST /auth/2fa/setup ────────────────────────────────────────────────────
 * Begin enrollment: generate a pending secret + QR. Does NOT enable 2FA yet. */
export const setup2fa = asyncHandler(async (req: Request, res: Response) => {
  requireEncryption();
  const user = await User.findById(req.user!._id).select('+twoFactorEnabled +twoFactorPendingSecret');
  if (!user) throw new ApiError(404, 'User not found.');
  if (user.twoFactorEnabled) throw new ApiError(400, 'Two-factor authentication is already enabled.');

  const secret = authenticator.generateSecret();
  user.twoFactorPendingSecret = sealSecret(secret);
  await user.save({ validateBeforeSave: false });

  const otpauth = authenticator.keyuri(req.user!.email, ISSUER, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauth);

  sendSuccess(res, { secret, otpauth, qrDataUrl }, 'Scan the QR code, then confirm with a code.');
});

/* ── POST /auth/2fa/enable  { token } ────────────────────────────────────────
 * Verify the first code against the pending secret, then enable 2FA and return
 * one-time recovery codes. */
export const enable2fa = asyncHandler(async (req: Request, res: Response) => {
  const parsed = z.object({ token: z.string().min(6).max(10) }).safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(400, 'A 6-digit code is required.');

  const user = await User.findById(req.user!._id).select('+twoFactorEnabled +twoFactorPendingSecret +twoFactorRecoveryCodes');
  if (!user) throw new ApiError(404, 'User not found.');
  if (user.twoFactorEnabled) throw new ApiError(400, 'Two-factor authentication is already enabled.');
  if (!user.twoFactorPendingSecret) throw new ApiError(400, 'Start setup first.');

  const secret = openSecret(user.twoFactorPendingSecret);
  if (!authenticator.verify({ token: parsed.data.token.replace(/\s/g, ''), secret })) {
    throw new ApiError(400, 'That code is incorrect or expired. Try again.');
  }

  const { plain, hashes } = generateRecoveryCodes();
  user.twoFactorSecret = user.twoFactorPendingSecret;
  user.twoFactorPendingSecret = null;
  user.twoFactorEnabled = true;
  user.twoFactorRecoveryCodes = hashes;
  await user.save({ validateBeforeSave: false });

  audit('auth.2fa.enabled', { userId: user._id.toString(), email: user.email });
  sendSuccess(res, { recoveryCodes: plain }, 'Two-factor authentication enabled.');
});

/* ── POST /auth/2fa/disable  { token } ───────────────────────────────────────
 * Disable 2FA after confirming a current TOTP or recovery code. */
export const disable2fa = asyncHandler(async (req: Request, res: Response) => {
  const parsed = z.object({ token: z.string().min(6).max(12) }).safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(400, 'A verification code is required.');

  const user = await User.findById(req.user!._id).select('+twoFactorEnabled +twoFactorSecret +twoFactorRecoveryCodes');
  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    throw new ApiError(400, 'Two-factor authentication is not enabled.');
  }

  if (!verifySecondFactor(user, parsed.data.token)) {
    throw new ApiError(400, 'That code is incorrect. Try again.');
  }

  user.twoFactorEnabled = false;
  user.twoFactorSecret = null;
  user.twoFactorPendingSecret = null;
  user.twoFactorRecoveryCodes = [];
  await user.save({ validateBeforeSave: false });

  audit('auth.2fa.disabled', { userId: user._id.toString(), email: user.email });
  sendSuccess(res, null, 'Two-factor authentication disabled.');
});

/* ── POST /auth/2fa/recovery-codes  { token } ────────────────────────────────
 * Regenerate recovery codes (invalidates the old set). */
export const regenerateRecoveryCodes = asyncHandler(async (req: Request, res: Response) => {
  const parsed = z.object({ token: z.string().min(6).max(12) }).safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(400, 'A verification code is required.');

  const user = await User.findById(req.user!._id).select('+twoFactorEnabled +twoFactorSecret +twoFactorRecoveryCodes');
  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    throw new ApiError(400, 'Two-factor authentication is not enabled.');
  }
  if (!verifySecondFactor(user, parsed.data.token)) {
    throw new ApiError(400, 'That code is incorrect. Try again.');
  }

  const { plain, hashes } = generateRecoveryCodes();
  user.twoFactorRecoveryCodes = hashes;
  await user.save({ validateBeforeSave: false });
  sendSuccess(res, { recoveryCodes: plain }, 'New recovery codes generated.');
});

/* ── POST /auth/2fa/login  { challengeToken, token } ─────────────────────────
 * Complete login by verifying the second factor; issues the session. (Public.) */
export const verify2faLogin = asyncHandler(async (req: Request, res: Response) => {
  const parsed = z.object({
    challengeToken: z.string().min(10),
    token: z.string().min(6).max(12),
  }).safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(400, 'A verification code is required.');

  let userId: string;
  try {
    userId = verify2faChallengeToken(parsed.data.challengeToken).id;
  } catch {
    throw new ApiError(401, 'Your sign-in session expired. Please log in again.');
  }

  const user = await User.findById(userId).select('+twoFactorEnabled +twoFactorSecret +twoFactorRecoveryCodes +refreshTokenHash');
  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    throw new ApiError(401, 'Two-factor authentication is not enabled for this account.');
  }
  if (!verifySecondFactor(user, parsed.data.token)) {
    throw new ApiError(401, 'That code is incorrect or expired.');
  }

  // Recovery code used → persist the consumed list before issuing the session.
  await user.save({ validateBeforeSave: false });
  audit('auth.2fa.login', { userId: user._id.toString(), email: user.email });
  await issueSession(req, res, user);
});

/**
 * Verify a TOTP token OR a recovery code against the user. If a recovery code is
 * used, it is consumed (removed from the list). Mutates `user` but does not save.
 */
function verifySecondFactor(user: any, token: string): boolean {
  const clean = token.replace(/\s/g, '');
  // TOTP path (6 digits).
  if (/^\d{6}$/.test(clean) && user.twoFactorSecret) {
    try {
      if (authenticator.verify({ token: clean, secret: openSecret(user.twoFactorSecret) })) return true;
    } catch {
      /* fall through to recovery code */
    }
  }
  // Recovery code path.
  const h = hashCode(clean);
  const idx = (user.twoFactorRecoveryCodes || []).indexOf(h);
  if (idx >= 0) {
    user.twoFactorRecoveryCodes.splice(idx, 1); // consume
    return true;
  }
  return false;
}
