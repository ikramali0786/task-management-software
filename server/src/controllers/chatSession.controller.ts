import { Request, Response } from 'express';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { z } from 'zod';
import { env } from '../config/env';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { Team } from '../models/Team.model';

// ── R2 client (returns null when credentials are not configured) ─────────────
const getR2 = (): S3Client | null => {
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    return null;
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
};

// Key format: chat-sessions/{teamId}/{botId}/{userId}.json
const r2Key = (teamId: string, botId: string, userId: string) =>
  `chat-sessions/${teamId}/${botId}/${userId}.json`;

const verifyMember = async (teamId: string, userId: string) => {
  const team = await Team.findById(teamId);
  if (!team) throw new ApiError(404, 'Team not found.');
  const member = team.members.find((m) => m.user.toString() === userId);
  if (!member) throw new ApiError(403, 'Not a team member.');
};

// ── StoredMessage shape ──────────────────────────────────────────────────────
const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  attachment: z
    .object({ name: z.string(), mimeType: z.string() })
    .optional(),
});

/* ── GET /api/chat-sessions/:botId?teamId=xxx ────────────────────────────── */
export const getChatSession = asyncHandler(async (req: Request, res: Response) => {
  const { botId } = req.params;
  const { teamId } = req.query as { teamId: string };
  if (!teamId) throw new ApiError(400, 'teamId is required.');

  const userId = req.user!._id.toString();
  await verifyMember(teamId, userId);

  const r2 = getR2();
  if (!r2) {
    // R2 not configured — client falls back to localStorage
    return sendSuccess(res, { messages: [], configured: false });
  }

  try {
    const obj = await r2.send(
      new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: r2Key(teamId, botId, userId) })
    );
    const raw = await obj.Body?.transformToString('utf-8');
    const data = raw ? JSON.parse(raw) : {};
    return sendSuccess(res, { messages: Array.isArray(data.messages) ? data.messages : [], configured: true });
  } catch (err: any) {
    // File doesn't exist yet → return empty (not an error)
    const is404 =
      err?.name === 'NoSuchKey' ||
      err?.Code === 'NoSuchKey' ||
      err?.$metadata?.httpStatusCode === 404;
    if (is404) {
      return sendSuccess(res, { messages: [], configured: true });
    }
    throw new ApiError(502, 'Failed to load chat history from storage.');
  }
});

/* ── PUT /api/chat-sessions/:botId ──────────────────────────────────────── */
export const saveChatSession = asyncHandler(async (req: Request, res: Response) => {
  const { botId } = req.params;

  const schema = z.object({
    teamId: z.string(),
    messages: z.array(messageSchema).max(200),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const userId = req.user!._id.toString();
  await verifyMember(parsed.data.teamId, userId);

  const r2 = getR2();
  if (!r2) {
    return sendSuccess(res, { saved: false, configured: false });
  }

  await r2.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: r2Key(parsed.data.teamId, botId, userId),
      Body: JSON.stringify({ messages: parsed.data.messages, updatedAt: new Date().toISOString() }),
      ContentType: 'application/json',
    })
  );

  sendSuccess(res, { saved: true, configured: true });
});

/* ── DELETE /api/chat-sessions/:botId?teamId=xxx ────────────────────────── */
export const deleteChatSession = asyncHandler(async (req: Request, res: Response) => {
  const { botId } = req.params;
  const { teamId } = req.query as { teamId: string };
  if (!teamId) throw new ApiError(400, 'teamId is required.');

  const userId = req.user!._id.toString();
  await verifyMember(teamId, userId);

  const r2 = getR2();
  if (!r2) {
    return sendSuccess(res, { deleted: false, configured: false });
  }

  try {
    await r2.send(
      new DeleteObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: r2Key(teamId, botId, userId),
      })
    );
  } catch {
    // Ignore — object may not exist
  }

  sendSuccess(res, { deleted: true, configured: true });
});
