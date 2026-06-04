import crypto from 'crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import { User } from '../models/User.model';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../services/auth.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';
import { audit } from '../utils/logger';

const getIP = (req: Request): string =>
  (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
  req.socket.remoteAddress ||
  'unknown';

const MAX_LOGIN_ATTEMPTS = 10;
const LOCK_DURATION_MS   = 30 * 60 * 1000; // 30 minutes

const hashToken = (token: string) =>
  crypto.createHash('sha256').update(token).digest('hex');

// Session lasts 30 days — appropriate for a team productivity tool where
// frequent re-authentication would be disruptive.
// SameSite=None + Secure is required for cross-origin cookie (frontend and
// backend are on different onrender.com subdomains in production).
// In development, fall back to 'lax' (localhost doesn't need cross-origin).
const refreshCookieOptions = () => ({
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: (env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30d
});

const passwordSchema = z
  .string()
  .min(8,   'Password must be at least 8 characters.')
  .max(128, 'Password must be no more than 128 characters.')
  .regex(/[A-Z]/,        'Password must contain at least one uppercase letter.')
  .regex(/[0-9]/,        'Password must contain at least one number.')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character (!@#$…).');

const registerSchema = z.object({
  name:     z.string().min(2).max(60),
  email:    z.string().email(),
  password: passwordSchema,
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional().default(false),
});

// Generate a unique username from the user's display name
const createUniqueUsername = async (name: string): Promise<string> => {
  const base = name
    .split(' ')[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 15) || 'user';
  for (let attempt = 0; attempt < 8; attempt++) {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const candidate = `${base}${suffix}`;
    const exists = await User.findOne({ username: candidate });
    if (!exists) return candidate;
  }
  return `${base}${Date.now().toString(36)}`;
};

export const register = asyncHandler(async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const { name, email, password } = parsed.data;

  const exists = await User.findOne({ email });
  if (exists) throw new ApiError(409, 'Email already in use.');

  const username = await createUniqueUsername(name);
  const user = await User.create({ name, username, email, password });

  audit('auth.register', { ip: getIP(req), email, userId: user._id.toString() });

  const accessToken  = generateAccessToken(user._id.toString());
  const refreshToken = generateRefreshToken(user._id.toString());

  // Store hash for rotation validation
  await User.findByIdAndUpdate(user._id, { refreshTokenHash: hashToken(refreshToken) });

  res.cookie('refreshToken', refreshToken, refreshCookieOptions());

  sendSuccess(
    res,
    {
      accessToken,
      user: {
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        theme: user.theme,
        timezone: user.timezone,
      },
    },
    'Account created successfully.',
    201
  );
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const { email, password } = parsed.data;

  const user = await User.findOne({ email }).select('+password +loginAttempts +lockUntil +refreshTokenHash');
  if (!user) throw new ApiError(401, 'No account found with this email address.');

  // Check account lockout
  if (user.lockUntil && user.lockUntil > new Date()) {
    const minutesLeft = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
    audit('auth.login.locked', { ip: getIP(req), email, minutesLeft });
    throw new ApiError(429, `Account locked due to too many failed attempts. Try again in ${minutesLeft} minute(s).`);
  }

  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    // Increment failed attempts
    user.loginAttempts = (user.loginAttempts || 0) + 1;
    const willLock = user.loginAttempts >= MAX_LOGIN_ATTEMPTS;
    if (willLock) {
      user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
      user.loginAttempts = 0;
      audit('auth.login.locked', { ip: getIP(req), email, reason: 'max attempts reached' });
    } else {
      audit('auth.login.failure', { ip: getIP(req), email, attempts: user.loginAttempts });
    }
    await user.save({ validateBeforeSave: false });
    throw new ApiError(401, 'Incorrect password. Please try again.');
  }

  // Successful login — reset lockout counters
  user.loginAttempts = 0;
  user.lockUntil = null;
  user.lastSeenAt = new Date();

  const accessToken  = generateAccessToken(user._id.toString());
  const refreshToken = generateRefreshToken(user._id.toString());

  // Store hash of refresh token for rotation validation
  user.refreshTokenHash = hashToken(refreshToken);
  await user.save({ validateBeforeSave: false });

  audit('auth.login.success', { ip: getIP(req), email, userId: user._id.toString() });

  res.cookie('refreshToken', refreshToken, refreshCookieOptions());

  sendSuccess(res, {
    accessToken,
    user: {
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      theme: user.theme,
      timezone: user.timezone,
    },
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken;
  if (token) {
    // Invalidate the stored token hash so it can't be reused
    try {
      const decoded = verifyRefreshToken(token);
      await User.findByIdAndUpdate(decoded.id, { refreshTokenHash: null });
      audit('auth.logout', { ip: getIP(req), userId: decoded.id });
    } catch {
      // Token already invalid — no-op
    }
  }
  res.clearCookie('refreshToken', refreshCookieOptions());
  sendSuccess(res, null, 'Logged out successfully.');
});

export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken;
  if (!token) throw new ApiError(401, 'No refresh token.');

  const decoded = verifyRefreshToken(token);
  const user = await User.findById(decoded.id).select('+refreshTokenHash');
  if (!user || !user.isActive) throw new ApiError(401, 'Invalid refresh token.');

  // Verify token matches stored hash (rotation check)
  const incomingHash = hashToken(token);
  if (!user.refreshTokenHash || user.refreshTokenHash !== incomingHash) {
    // Token reuse detected — clear hash to force full re-login
    await User.findByIdAndUpdate(decoded.id, { refreshTokenHash: null });
    audit('auth.token.reuse', { ip: getIP(req), userId: decoded.id });
    throw new ApiError(401, 'Refresh token reuse detected. Please log in again.');
  }

  const newAccessToken  = generateAccessToken(user._id.toString());
  const newRefreshToken = generateRefreshToken(user._id.toString());

  // Rotate: replace stored hash with new token's hash
  user.refreshTokenHash = hashToken(newRefreshToken);
  await user.save({ validateBeforeSave: false });

  res.cookie('refreshToken', newRefreshToken, refreshCookieOptions());
  sendSuccess(res, { accessToken: newAccessToken });
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user?._id).populate('teams', 'name slug avatar');
  sendSuccess(res, { user });
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    name: z.string().min(2).max(60).optional(),
    username: z.string().min(3).max(30).regex(/^[a-z0-9_]+$/, 'Username may only contain lowercase letters, numbers and underscores').optional(),
    avatar: z.string().url().optional().nullable(),
    timezone: z.string().optional(),
    theme: z.enum(['light', 'dark', 'system']).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  // Ensure username is unique if being changed
  if (parsed.data.username) {
    const conflict = await User.findOne({ username: parsed.data.username, _id: { $ne: req.user?._id } });
    if (conflict) throw new ApiError(409, 'Username already taken.');
  }

  const user = await User.findByIdAndUpdate(req.user?._id, parsed.data, { new: true });
  sendSuccess(res, { user });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema,
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const user = await User.findById(req.user?._id).select('+password');
  if (!user) throw new ApiError(404, 'User not found.');

  const isMatch = await user.comparePassword(parsed.data.currentPassword);
  if (!isMatch) throw new ApiError(401, 'Current password is incorrect.');

  user.password = parsed.data.newPassword;
  await user.save();

  audit('auth.password.changed', { ip: getIP(req), userId: req.user!._id.toString() });
  sendSuccess(res, null, 'Password changed successfully.');
});
