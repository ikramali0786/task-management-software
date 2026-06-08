import { Request, Response } from 'express';
import { z } from 'zod';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Whiteboard } from '../models/Whiteboard.model';
import { Team } from '../models/Team.model';
import { env } from '../config/env';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { hasPermission } from '../utils/permissions';

// R2 (S3-compatible) client for whiteboard image uploads.
const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
});
const IMG_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/avif']);
const IMG_MAX = 10 * 1024 * 1024; // 10 MB

const verifyMember = async (teamId: string, userId: string) => {
  const team = await Team.findById(teamId);
  if (!team) throw new ApiError(404, 'Team not found.');
  const member = team.members.find((m) => m.user.toString() === userId);
  if (!member) throw new ApiError(403, 'Not a member of this team.');
  return team;
};

/* GET /whiteboard?teamId=… — load (creating an empty board on first access). */
export const getWhiteboard = asyncHandler(async (req: Request, res: Response) => {
  const { teamId } = req.query as Record<string, string>;
  if (!teamId) throw new ApiError(400, 'teamId is required.');
  await verifyMember(teamId, req.user!._id.toString());

  const board = await Whiteboard.findOne({ team: teamId }).select('elements updatedAt');
  sendSuccess(res, { elements: board?.elements ?? [], updatedAt: board?.updatedAt ?? null });
});

/* PUT /whiteboard?teamId=… — save the whole board (last-writer-wins). */
export const saveWhiteboard = asyncHandler(async (req: Request, res: Response) => {
  const { teamId } = req.query as Record<string, string>;
  if (!teamId) throw new ApiError(400, 'teamId is required.');

  const schema = z.object({ elements: z.array(z.any()).max(5000) });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(400, 'Invalid board payload.');

  const userId = req.user!._id.toString();
  const team = await verifyMember(teamId, userId);
  // Read-only members (viewers / guests) can view but not persist changes.
  if (!hasPermission(team, userId, 'commentOnTasks')) {
    throw new ApiError(403, 'You have read-only access to this whiteboard.', { code: 'PERMISSION_DENIED' });
  }

  const board = await Whiteboard.findOneAndUpdate(
    { team: teamId },
    { $set: { elements: parsed.data.elements, updatedBy: req.user!._id } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Live propagation happens via socket `whiteboard:op` events (element-level);
  // this endpoint only persists the merged result for fresh loads.
  sendSuccess(res, { updatedAt: board.updatedAt }, 'Saved.');
});

/* POST /whiteboard/image?teamId=… — pre-signed PUT URL for a board image. */
export const presignBoardImage = asyncHandler(async (req: Request, res: Response) => {
  const { teamId } = req.query as Record<string, string>;
  if (!teamId) throw new ApiError(400, 'teamId is required.');

  const schema = z.object({
    filename: z.string().min(1),
    contentType: z.string().min(1),
    size: z.number().int().positive(),
  });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(400, 'Invalid upload payload.');
  const { filename, contentType, size } = parsed.data;

  if (!IMG_MIME.has(contentType)) throw new ApiError(400, `Image type "${contentType}" is not allowed.`);
  if (size > IMG_MAX) throw new ApiError(400, 'Image exceeds the 10 MB limit.');

  const userId = req.user!._id.toString();
  const team = await verifyMember(teamId, userId);
  if (!hasPermission(team, userId, 'commentOnTasks')) {
    throw new ApiError(403, 'You have read-only access to this whiteboard.', { code: 'PERMISSION_DENIED' });
  }

  const missing = [
    !env.R2_ACCOUNT_ID && 'R2_ACCOUNT_ID', !env.R2_ACCESS_KEY_ID && 'R2_ACCESS_KEY_ID',
    !env.R2_SECRET_ACCESS_KEY && 'R2_SECRET_ACCESS_KEY', !env.R2_PUBLIC_URL && 'R2_PUBLIC_URL',
  ].filter(Boolean);
  if (missing.length) throw new ApiError(503, `Image storage is not configured. Missing: ${missing.join(', ')}`);

  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  const fileKey = `boards/${teamId}/${crypto.randomUUID()}-${safe}`;
  const command = new PutObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: fileKey, ContentType: contentType, ContentLength: size });
  const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 300 });
  const publicUrl = `${env.R2_PUBLIC_URL.replace(/\/$/, '')}/${fileKey}`;

  sendSuccess(res, { uploadUrl, publicUrl });
});
