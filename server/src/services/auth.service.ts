import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export const generateAccessToken = (userId: string): string => {
  return jwt.sign({ id: userId }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as string,
  } as jwt.SignOptions);
};

export const generateRefreshToken = (userId: string): string => {
  return jwt.sign({ id: userId }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as string,
  } as jwt.SignOptions);
};

export const verifyAccessToken = (token: string): { id: string } => {
  return jwt.verify(token, env.JWT_SECRET) as { id: string };
};

export const verifyRefreshToken = (token: string): { id: string } => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as { id: string };
};

// ── 2FA login challenge ──────────────────────────────────────────────────────
// Short-lived token issued after a correct password when 2FA is enabled. It is
// NOT a session token — it only authorizes completing the second factor.
export const generate2faChallengeToken = (userId: string): string =>
  jwt.sign({ id: userId, twofa: true }, env.JWT_SECRET, { expiresIn: '5m' } as jwt.SignOptions);

export const verify2faChallengeToken = (token: string): { id: string } => {
  const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string; twofa?: boolean };
  if (!decoded.twofa) throw new Error('Not a 2FA challenge token');
  return { id: decoded.id };
};
