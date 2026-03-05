import { Request, Response } from 'express';
import { z } from 'zod';
import { User } from '../models/User.model';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../services/auth.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';

const refreshCookieOptions = (rememberMe = true) => ({
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000, // 30d or 1d
});

const registerSchema = z.object({
  name: z.string().min(2).max(60),
  email: z.string().email(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(14, 'Password must be no more than 14 characters.'),
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

  const accessToken = generateAccessToken(user._id.toString());
  const refreshToken = generateRefreshToken(user._id.toString());

  res.cookie('refreshToken', refreshToken, refreshCookieOptions(true));

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

  const { email, password, rememberMe } = parsed.data;

  const user = await User.findOne({ email }).select('+password');
  if (!user) throw new ApiError(401, 'No account found with this email address.');

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw new ApiError(401, 'Incorrect password. Please try again.');

  const accessToken = generateAccessToken(user._id.toString());
  const refreshToken = generateRefreshToken(user._id.toString());

  user.lastSeenAt = new Date();
  await user.save({ validateBeforeSave: false });

  res.cookie('refreshToken', refreshToken, refreshCookieOptions(rememberMe));

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

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  res.clearCookie('refreshToken', refreshCookieOptions());
  sendSuccess(res, null, 'Logged out successfully.');
});

export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken;
  if (!token) throw new ApiError(401, 'No refresh token.');

  const decoded = verifyRefreshToken(token);
  const user = await User.findById(decoded.id);
  if (!user || !user.isActive) throw new ApiError(401, 'Invalid refresh token.');

  const newAccessToken = generateAccessToken(user._id.toString());
  const newRefreshToken = generateRefreshToken(user._id.toString());

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
    newPassword: z.string().min(8),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const user = await User.findById(req.user?._id).select('+password');
  if (!user) throw new ApiError(404, 'User not found.');

  const isMatch = await user.comparePassword(parsed.data.currentPassword);
  if (!isMatch) throw new ApiError(401, 'Current password is incorrect.');

  user.password = parsed.data.newPassword;
  await user.save();

  sendSuccess(res, null, 'Password changed successfully.');
});
