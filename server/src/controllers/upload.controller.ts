import { Request, Response } from 'express';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';
import { Attachment } from '../models/Attachment.model';
import { getIO } from '../config/socket';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

// ── R2 client (S3-compatible) ──────────────────────────────────────────────
const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

const ALLOWED_MIME_TYPES = new Set([
  // Images
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'image/svg+xml', 'image/avif',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv', 'text/markdown',
  // Archives
  'application/zip', 'application/x-zip-compressed',
]);

/**
 * POST /api/uploads/presign
 * Returns a short-lived (5 min) pre-signed PUT URL so the browser can upload
 * directly to R2 without routing the file through the Express server.
 */
export const presignUpload = asyncHandler(async (req: Request, res: Response) => {
  const { filename, contentType, size, taskId } = req.body as {
    filename: string;
    contentType: string;
    size: number;
    taskId: string;
  };

  if (!filename || !contentType || !size || !taskId) {
    throw new ApiError(400, 'filename, contentType, size and taskId are required.');
  }
  if (!ALLOWED_MIME_TYPES.has(contentType)) {
    throw new ApiError(400, `File type "${contentType}" is not allowed.`);
  }
  if (size > MAX_SIZE_BYTES) {
    throw new ApiError(400, 'File exceeds the 50 MB limit.');
  }
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID) {
    throw new ApiError(503, 'File storage is not configured.');
  }

  // Build a unique, safe object key
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
  const fileKey = `tasks/${taskId}/${crypto.randomUUID()}-${safeFilename}`;

  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: fileKey,
    ContentType: contentType,
    ContentLength: size,
  });

  const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 300 }); // 5 min
  const publicUrl = `${env.R2_PUBLIC_URL.replace(/\/$/, '')}/${fileKey}`;

  res.json({ success: true, data: { uploadUrl, fileKey, publicUrl } });
});

/**
 * POST /api/uploads/confirm
 * Called by the browser after a successful PUT to R2.
 * Saves the file metadata to MongoDB and broadcasts to the team via socket.
 */
export const confirmUpload = asyncHandler(async (req: Request, res: Response) => {
  const { fileKey, filename, size, contentType, taskId, teamId } = req.body as {
    fileKey: string;
    filename: string;
    size: number;
    contentType: string;
    taskId: string;
    teamId: string;
  };
  const userId = (req as any).user._id;

  if (!fileKey || !filename || !size || !contentType || !taskId || !teamId) {
    throw new ApiError(400, 'All fields are required.');
  }

  const publicUrl = `${env.R2_PUBLIC_URL.replace(/\/$/, '')}/${fileKey}`;

  const attachment = await Attachment.create({
    task: taskId,
    team: teamId,
    uploadedBy: userId,
    filename,
    fileKey,
    publicUrl,
    contentType,
    size,
  });

  const populated = await attachment.populate('uploadedBy', 'name avatar');

  // Real-time: notify everyone else in the team
  const io = getIO();
  if (io) {
    io.to(`team:${teamId}`).emit('attachment:added', { taskId, attachment: populated });
  }

  res.status(201).json({ success: true, data: populated });
});

/**
 * GET /api/uploads/:taskId
 * Returns all attachments for a task, newest first.
 */
export const getAttachments = asyncHandler(async (req: Request, res: Response) => {
  const { taskId } = req.params;
  const attachments = await Attachment.find({ task: taskId })
    .populate('uploadedBy', 'name avatar')
    .sort({ createdAt: -1 });
  res.json({ success: true, data: attachments });
});

/**
 * DELETE /api/uploads/:attachmentId
 * Deletes from R2 + MongoDB and broadcasts the removal.
 * Only the original uploader may delete.
 */
export const deleteAttachment = asyncHandler(async (req: Request, res: Response) => {
  const { attachmentId } = req.params;
  const userId = (req as any).user._id;

  const attachment = await Attachment.findById(attachmentId);
  if (!attachment) throw new ApiError(404, 'Attachment not found.');
  if (attachment.uploadedBy.toString() !== userId.toString()) {
    throw new ApiError(403, 'You can only delete your own attachments.');
  }

  // Delete from R2
  await r2.send(
    new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: attachment.fileKey })
  );

  await attachment.deleteOne();

  const io = getIO();
  if (io) {
    io.to(`team:${attachment.team.toString()}`).emit('attachment:deleted', {
      taskId: attachment.task.toString(),
      attachmentId,
    });
  }

  res.json({ success: true, message: 'Attachment deleted.' });
});
