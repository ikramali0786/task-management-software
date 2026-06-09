import crypto from 'crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Whiteboard } from '../models/Whiteboard.model';
import { WhiteboardSnapshot } from '../models/WhiteboardSnapshot.model';
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
const MAX_SNAPSHOTS = 30;
const AUTO_SNAPSHOT_MS = 10 * 60 * 1000;

const verifyMember = async (teamId: string, userId: string) => {
  const team = await Team.findById(teamId);
  if (!team) throw new ApiError(404, 'Team not found.');
  const member = team.members.find((m) => m.user.toString() === userId);
  if (!member) throw new ApiError(403, 'Not a member of this team.');
  return team;
};

// One-time: drop the legacy unique index on `team` so a team can own >1 board.
let indexFixed = false;
const ensureIndexes = async () => {
  if (indexFixed) return; indexFixed = true;
  try { await Whiteboard.collection.dropIndex('team_1'); } catch { /* already gone */ }
};

const canWrite = (team: any, userId: string) => {
  if (!hasPermission(team, userId, 'commentOnTasks')) {
    throw new ApiError(403, 'You have read-only access to this whiteboard.', { code: 'PERMISSION_DENIED' });
  }
};

const genToken = () => crypto.randomBytes(9).toString('base64url');

// Best-effort: delete every R2 object stored under a board's image prefix.
const deleteBoardImages = async (teamId: string, boardId: string) => {
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID) return;
  const Prefix = `boards/${teamId}/${boardId}/`;
  try {
    let token: string | undefined;
    do {
      const listed = await r2.send(new ListObjectsV2Command({ Bucket: env.R2_BUCKET_NAME, Prefix, ContinuationToken: token }));
      const keys = (listed.Contents ?? []).map((o) => ({ Key: o.Key! })).filter((k) => k.Key);
      if (keys.length) await r2.send(new DeleteObjectsCommand({ Bucket: env.R2_BUCKET_NAME, Delete: { Objects: keys, Quiet: true } }));
      token = listed.IsTruncated ? listed.NextContinuationToken : undefined;
    } while (token);
  } catch (err) { console.error('[R2] board image cleanup failed:', err); }
};

const boardMeta = (b: any) => ({
  _id: b._id, name: b.name || 'Main board', preview: b.preview ?? [], elementCount: Array.isArray(b.elements) ? b.elements.length : (b.preview?.length ?? 0),
  isPublic: !!b.isPublic, publicToken: b.publicToken ?? null,
  createdBy: b.createdBy, updatedAt: b.updatedAt, createdAt: b.createdAt,
});

const loadBoard = async (boardId: string, userId: string) => {
  const board = await Whiteboard.findById(boardId);
  if (!board) throw new ApiError(404, 'Board not found.');
  const team = await verifyMember(board.team.toString(), userId);
  return { board, team };
};

/* GET /whiteboard/boards?teamId=… — list a team's boards (auto-creates one). */
export const getBoards = asyncHandler(async (req: Request, res: Response) => {
  const { teamId } = req.query as Record<string, string>;
  if (!teamId) throw new ApiError(400, 'teamId is required.');
  const userId = req.user!._id.toString();
  await verifyMember(teamId, userId);
  await ensureIndexes();

  let boards = await Whiteboard.find({ team: teamId }).select('name preview isPublic publicToken createdBy updatedAt createdAt').sort({ updatedAt: -1 });
  if (boards.length === 0) {
    const created = await Whiteboard.create({ team: teamId, name: 'Main board', createdBy: req.user!._id, updatedBy: req.user!._id });
    boards = [created];
  }
  sendSuccess(res, { boards: boards.map(boardMeta) });
});

/* POST /whiteboard/boards?teamId=… — create a board (optionally from a template). */
export const createBoard = asyncHandler(async (req: Request, res: Response) => {
  const { teamId } = req.query as Record<string, string>;
  if (!teamId) throw new ApiError(400, 'teamId is required.');
  const userId = req.user!._id.toString();
  const team = await verifyMember(teamId, userId);
  canWrite(team, userId);
  await ensureIndexes();

  const schema = z.object({ name: z.string().trim().min(1).max(80).optional(), elements: z.array(z.any()).max(5000).optional(), preview: z.array(z.any()).max(2000).optional() });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(400, 'Invalid board payload.');

  const board = await Whiteboard.create({
    team: teamId, name: parsed.data.name || 'Untitled board',
    elements: parsed.data.elements ?? [], preview: parsed.data.preview ?? [],
    createdBy: req.user!._id, updatedBy: req.user!._id,
  });
  sendSuccess(res, { board: boardMeta(board) }, 'Board created.', 201);
});

/* PATCH /whiteboard/boards/:boardId — rename. */
export const renameBoard = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id.toString();
  const { board, team } = await loadBoard(req.params.boardId, userId);
  canWrite(team, userId);
  const schema = z.object({ name: z.string().trim().min(1).max(80) });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(400, 'A board name is required.');
  board.name = parsed.data.name; board.updatedBy = req.user!._id; await board.save();
  sendSuccess(res, { board: boardMeta(board) }, 'Renamed.');
});

/* DELETE /whiteboard/boards/:boardId — delete a board and its snapshots. */
export const deleteBoard = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id.toString();
  const { board, team } = await loadBoard(req.params.boardId, userId);
  canWrite(team, userId);
  await WhiteboardSnapshot.deleteMany({ board: board._id });
  await deleteBoardImages(board.team.toString(), board._id.toString());
  await board.deleteOne();
  sendSuccess(res, { deleted: true }, 'Board deleted.');
});

/* GET /whiteboard?boardId=… — load one board's elements. */
export const getWhiteboard = asyncHandler(async (req: Request, res: Response) => {
  const { boardId } = req.query as Record<string, string>;
  if (!boardId) throw new ApiError(400, 'boardId is required.');
  const { board } = await loadBoard(boardId, req.user!._id.toString());
  sendSuccess(res, { elements: board.elements ?? [], name: board.name || 'Main board', updatedAt: board.updatedAt });
});

/* PUT /whiteboard?boardId=… — save a board (last-writer-wins) + auto-snapshot. */
export const saveWhiteboard = asyncHandler(async (req: Request, res: Response) => {
  const { boardId } = req.query as Record<string, string>;
  if (!boardId) throw new ApiError(400, 'boardId is required.');
  const userId = req.user!._id.toString();
  const { board, team } = await loadBoard(boardId, userId);
  canWrite(team, userId);

  const schema = z.object({ elements: z.array(z.any()).max(5000), preview: z.array(z.any()).max(2000).optional() });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(400, 'Invalid board payload.');

  board.elements = parsed.data.elements;
  if (parsed.data.preview) board.preview = parsed.data.preview as any;
  board.updatedBy = req.user!._id;
  await board.save();

  // Auto-snapshot at most once per ~10 min so history has restore points.
  const last = await WhiteboardSnapshot.findOne({ board: board._id }).sort({ createdAt: -1 }).select('createdAt');
  if (!last || Date.now() - new Date(last.createdAt).getTime() > AUTO_SNAPSHOT_MS) {
    await WhiteboardSnapshot.create({ board: board._id, team: board.team, elements: board.elements, label: 'Auto-save', createdBy: req.user!._id });
    const extra = await WhiteboardSnapshot.find({ board: board._id }).sort({ createdAt: -1 }).skip(MAX_SNAPSHOTS).select('_id');
    if (extra.length) await WhiteboardSnapshot.deleteMany({ _id: { $in: extra.map((e) => e._id) } });
  }
  sendSuccess(res, { updatedAt: board.updatedAt }, 'Saved.');
});

/* GET /whiteboard/boards/:boardId/snapshots — list version history. */
export const listSnapshots = asyncHandler(async (req: Request, res: Response) => {
  const { board } = await loadBoard(req.params.boardId, req.user!._id.toString());
  const snaps = await WhiteboardSnapshot.find({ board: board._id }).select('label createdBy createdAt elements').sort({ createdAt: -1 }).populate('createdBy', 'name avatar');
  sendSuccess(res, { snapshots: snaps.map((s) => ({ _id: s._id, label: s.label, createdBy: s.createdBy, createdAt: s.createdAt, elementCount: Array.isArray(s.elements) ? s.elements.length : 0 })) });
});

/* POST /whiteboard/boards/:boardId/snapshots — manual "save version". */
export const createSnapshot = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id.toString();
  const { board, team } = await loadBoard(req.params.boardId, userId);
  canWrite(team, userId);
  const label = (typeof req.body?.label === 'string' && req.body.label.trim().slice(0, 80)) || 'Saved version';
  const snap = await WhiteboardSnapshot.create({ board: board._id, team: board.team, elements: board.elements, label, createdBy: req.user!._id });
  const extra = await WhiteboardSnapshot.find({ board: board._id }).sort({ createdAt: -1 }).skip(MAX_SNAPSHOTS).select('_id');
  if (extra.length) await WhiteboardSnapshot.deleteMany({ _id: { $in: extra.map((e) => e._id) } });
  sendSuccess(res, { snapshot: { _id: snap._id, label: snap.label, createdAt: snap.createdAt } }, 'Version saved.', 201);
});

/* POST /whiteboard/boards/:boardId/snapshots/:snapshotId/restore — restore. */
export const restoreSnapshot = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id.toString();
  const { board, team } = await loadBoard(req.params.boardId, userId);
  canWrite(team, userId);
  const snap = await WhiteboardSnapshot.findOne({ _id: req.params.snapshotId, board: board._id });
  if (!snap) throw new ApiError(404, 'Snapshot not found.');
  // Keep the pre-restore state as its own snapshot so a restore is reversible.
  await WhiteboardSnapshot.create({ board: board._id, team: board.team, elements: board.elements, label: 'Before restore', createdBy: req.user!._id });
  board.elements = snap.elements; board.updatedBy = req.user!._id; await board.save();
  sendSuccess(res, { elements: board.elements }, 'Restored.');
});

/* POST /whiteboard/boards/:boardId/share — enable a public read-only link. */
export const enableShare = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id.toString();
  const { board, team } = await loadBoard(req.params.boardId, userId);
  canWrite(team, userId);
  if (!board.publicToken) board.publicToken = genToken();
  board.isPublic = true; await board.save();
  sendSuccess(res, { isPublic: true, publicToken: board.publicToken }, 'Public link enabled.');
});

/* DELETE /whiteboard/boards/:boardId/share — disable the public link (token kept). */
export const disableShare = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id.toString();
  const { board, team } = await loadBoard(req.params.boardId, userId);
  canWrite(team, userId);
  board.isPublic = false; await board.save();
  sendSuccess(res, { isPublic: false, publicToken: board.publicToken }, 'Public link disabled.');
});

/* POST /whiteboard/image?teamId=… — pre-signed PUT URL for a board image. */
export const presignBoardImage = asyncHandler(async (req: Request, res: Response) => {
  const { teamId } = req.query as Record<string, string>;
  if (!teamId) throw new ApiError(400, 'teamId is required.');

  const schema = z.object({ filename: z.string().min(1), contentType: z.string().min(1), size: z.number().int().positive(), boardId: z.string().optional() });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(400, 'Invalid upload payload.');
  const { filename, contentType, size, boardId } = parsed.data;

  if (!IMG_MIME.has(contentType)) throw new ApiError(400, `Image type "${contentType}" is not allowed.`);
  if (size > IMG_MAX) throw new ApiError(400, 'Image exceeds the 10 MB limit.');

  const userId = req.user!._id.toString();
  const team = await verifyMember(teamId, userId);
  canWrite(team, userId);

  const missing = [
    !env.R2_ACCOUNT_ID && 'R2_ACCOUNT_ID', !env.R2_ACCESS_KEY_ID && 'R2_ACCESS_KEY_ID',
    !env.R2_SECRET_ACCESS_KEY && 'R2_SECRET_ACCESS_KEY', !env.R2_PUBLIC_URL && 'R2_PUBLIC_URL',
  ].filter(Boolean);
  if (missing.length) throw new ApiError(503, `Image storage is not configured. Missing: ${missing.join(', ')}`);

  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  // Board-scoped key so a board's images can be cleaned up when the board is deleted.
  const safeBoard = boardId && /^[a-f0-9]{24}$/i.test(boardId) ? `${boardId}/` : '';
  const fileKey = `boards/${teamId}/${safeBoard}${crypto.randomUUID()}-${safe}`;
  const command = new PutObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: fileKey, ContentType: contentType, ContentLength: size });
  const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 300 });
  const publicUrl = `${env.R2_PUBLIC_URL.replace(/\/$/, '')}/${fileKey}`;

  sendSuccess(res, { uploadUrl, publicUrl });
});
