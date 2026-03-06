import { Request, Response } from 'express';
import { z } from 'zod';
import { ApiKey } from '../models/ApiKey.model';
import { Team } from '../models/Team.model';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { encrypt, decrypt } from '../utils/encrypt';

const isAdmin = (team: any, userId: string): boolean => {
  const member = team.members.find((m: any) => m.user.toString() === userId);
  return member?.role === 'admin' || member?.role === 'owner';
};

const verifyAdminAccess = async (teamId: string, userId: string) => {
  const team = await Team.findById(teamId);
  if (!team) throw new ApiError(404, 'Team not found.');
  const isOwner = team.owner.toString() === userId;
  const member = team.members.find((m) => m.user.toString() === userId);
  if (!member && !isOwner) throw new ApiError(403, 'Not a member of this team.');
  const hasAccess = isOwner || member?.role === 'admin' || member?.role === 'owner';
  if (!hasAccess) throw new ApiError(403, 'Only admins can manage API keys.');
  return team;
};

const verifyMemberAccess = async (teamId: string, userId: string) => {
  const team = await Team.findById(teamId);
  if (!team) throw new ApiError(404, 'Team not found.');
  const member = team.members.find((m) => m.user.toString() === userId);
  if (!member) throw new ApiError(403, 'Not a member of this team.');
  return team;
};

export const getTeamApiKey = asyncHandler(async (req: Request, res: Response) => {
  const { teamId } = req.params;
  await verifyMemberAccess(teamId, req.user!._id.toString());

  const apiKey = await ApiKey.findOne({ team: teamId });
  if (!apiKey) return sendSuccess(res, { apiKey: null });

  sendSuccess(res, {
    apiKey: {
      keyHint: apiKey.keyHint,
      label: apiKey.label,
      model: apiKey.model,
      createdAt: apiKey.createdAt,
    },
  });
});

export const setTeamApiKey = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    key: z.string().min(20, 'API key is too short'),
    label: z.string().max(100).optional(),
    model: z.enum(['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo']).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const { teamId } = req.params;
  const userId = req.user!._id.toString();
  await verifyAdminAccess(teamId, userId);

  const { key, label = 'Team API Key', model = 'gpt-4o-mini' } = parsed.data;

  // Guard: ENCRYPTION_SECRET must be present. On Render, set it manually via
  // Dashboard → taskflow-server → Environment → Add variable: ENCRYPTION_SECRET
  if (!process.env.ENCRYPTION_SECRET) {
    throw new ApiError(500, 'Server misconfiguration: ENCRYPTION_SECRET is not set. Add it in your hosting environment and redeploy.');
  }

  // Build hint: first 3 chars + "..." + last 4 chars
  const keyHint = key.length > 8
    ? `${key.slice(0, 3)}...${key.slice(-4)}`
    : '***';

  const { encryptedKey, iv, authTag } = encrypt(key);

  await ApiKey.findOneAndUpdate(
    { team: teamId },
    { encryptedKey, iv, authTag, keyHint, label, model, createdBy: userId },
    { upsert: true, new: true }
  );

  sendSuccess(res, { apiKey: { keyHint, label, model } }, 'API key saved.');
});

export const deleteTeamApiKey = asyncHandler(async (req: Request, res: Response) => {
  const { teamId } = req.params;
  await verifyAdminAccess(teamId, req.user!._id.toString());

  await ApiKey.findOneAndDelete({ team: teamId });
  sendSuccess(res, null, 'API key removed.');
});

/**
 * Internal helper — used by chatbot controller only, NOT exposed via HTTP.
 */
export const getDecryptedKey = async (teamId: string): Promise<string | null> => {
  const apiKey = await ApiKey.findOne({ team: teamId });
  if (!apiKey) return null;
  return decrypt({ encryptedKey: apiKey.encryptedKey, iv: apiKey.iv, authTag: apiKey.authTag });
};
