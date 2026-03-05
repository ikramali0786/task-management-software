import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Paperclip, Upload, X, Trash2, FileText, FileSpreadsheet,
  FileImage, File, ExternalLink, Loader2,
} from 'lucide-react';
import { Attachment } from '@/types';
import { uploadService, UploadProgress } from '@/services/uploadService';
import { useAuthStore } from '@/store/authStore';
import { Avatar } from '@/components/ui/Avatar';
import { cn, formatRelative } from '@/lib/utils';
import { getSocket } from '@/lib/socket';

// ── Constants ───────────────────────────────────────────────────────────────
const MAX_SIZE_MB = 50;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/avif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv', 'text/markdown',
  'application/zip', 'application/x-zip-compressed',
]);

// ── Helpers ──────────────────────────────────────────────────────────────────
const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileIcon = (contentType: string) => {
  if (contentType.startsWith('image/')) return FileImage;
  if (contentType === 'application/pdf') return FileText;
  if (contentType.includes('spreadsheet') || contentType.includes('excel') || contentType === 'text/csv')
    return FileSpreadsheet;
  if (contentType.includes('word') || contentType.includes('document') || contentType === 'text/plain')
    return FileText;
  return File;
};

const getFileIconColor = (contentType: string): string => {
  if (contentType.startsWith('image/')) return 'text-violet-500';
  if (contentType === 'application/pdf') return 'text-red-500';
  if (contentType.includes('spreadsheet') || contentType.includes('excel') || contentType === 'text/csv')
    return 'text-emerald-500';
  if (contentType.includes('word') || contentType.includes('document')) return 'text-blue-500';
  return 'text-slate-400';
};

// ── Upload queue item ────────────────────────────────────────────────────────
interface QueueItem {
  id: string;
  file: File;
  progress: UploadProgress;
  status: 'uploading' | 'done' | 'error';
  error?: string;
}

// ── Props ────────────────────────────────────────────────────────────────────
interface AttachmentPanelProps {
  taskId: string;
  teamId: string;
}

// ── Component ────────────────────────────────────────────────────────────────
export const AttachmentPanel = ({ taskId, teamId }: AttachmentPanelProps) => {
  const { user } = useAuthStore();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  // ── Fetch attachments on mount ────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    uploadService.getAttachments(taskId)
      .then(setAttachments)
      .finally(() => setLoading(false));
  }, [taskId]);

  // ── Socket: real-time updates from teammates ──────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onAdded = ({ taskId: tid, attachment }: { taskId: string; attachment: Attachment }) => {
      if (tid !== taskId || attachment.uploadedBy._id === user?._id) return;
      setAttachments((prev) => [attachment, ...prev]);
    };

    const onDeleted = ({ taskId: tid, attachmentId }: { taskId: string; attachmentId: string }) => {
      if (tid !== taskId) return;
      setAttachments((prev) => prev.filter((a) => a._id !== attachmentId));
    };

    socket.on('attachment:added', onAdded);
    socket.on('attachment:deleted', onDeleted);

    return () => {
      socket.off('attachment:added', onAdded);
      socket.off('attachment:deleted', onDeleted);
    };
  }, [taskId, user?._id]);

  // ── File validation ───────────────────────────────────────────────────────
  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.has(file.type)) return `"${file.name}" has an unsupported file type.`;
    if (file.size > MAX_SIZE_BYTES) return `"${file.name}" exceeds the ${MAX_SIZE_MB} MB limit.`;
    return null;
  };

  // ── Upload a single file ──────────────────────────────────────────────────
  const uploadFile = useCallback(
    async (file: File) => {
      const error = validateFile(file);
      const id = crypto.randomUUID();

      if (error) {
        setQueue((prev) => [
          ...prev,
          { id, file, progress: { loaded: 0, total: 0, percent: 0 }, status: 'error', error },
        ]);
        return;
      }

      setQueue((prev) => [
        ...prev,
        { id, file, progress: { loaded: 0, total: file.size, percent: 0 }, status: 'uploading' },
      ]);

      try {
        const attachment = await uploadService.uploadFile(file, taskId, teamId, (progress) => {
          setQueue((prev) =>
            prev.map((item) => (item.id === id ? { ...item, progress } : item))
          );
        });

        // Add to list optimistically; socket will also broadcast to teammates
        setAttachments((prev) => [attachment, ...prev]);
        setQueue((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status: 'done' } : item))
        );
        // Remove the completed item from the queue after a short delay
        setTimeout(() => setQueue((prev) => prev.filter((item) => item.id !== id)), 1500);
      } catch (err: any) {
        setQueue((prev) =>
          prev.map((item) =>
            item.id === id
              ? { ...item, status: 'error', error: err.message || 'Upload failed' }
              : item
          )
        );
      }
    },
    [taskId, teamId]
  );

  const handleFiles = (files: FileList | File[]) => {
    Array.from(files).forEach(uploadFile);
  };

  // ── Drag-and-drop ─────────────────────────────────────────────────────────
  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current += 1;
    if (dragCounter.current === 1) setIsDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setIsDragging(false);
  };
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (attachment: Attachment) => {
    if (!confirm(`Delete "${attachment.filename}"? This cannot be undone.`)) return;
    setDeletingId(attachment._id);
    try {
      await uploadService.deleteAttachment(attachment._id);
      setAttachments((prev) => prev.filter((a) => a._id !== attachment._id));
    } finally {
      setDeletingId(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <Paperclip className="h-3.5 w-3.5" />
        Attachments
        {attachments.length > 0 && (
          <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800">
            {attachments.length}
          </span>
        )}
      </h3>

      {/* Drop zone */}
      <div
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 transition-colors',
          isDragging
            ? 'border-brand-400 bg-brand-50 dark:bg-brand-500/10'
            : 'border-slate-200 bg-slate-50 hover:border-brand-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-brand-600 dark:hover:bg-slate-800'
        )}
      >
        <Upload className={cn('h-5 w-5 transition-colors', isDragging ? 'text-brand-500' : 'text-slate-400')} />
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          <span className="font-medium text-brand-500">Click to upload</span> or drag &amp; drop
          <br />
          Max {MAX_SIZE_MB} MB · Images, PDFs, Docs, Spreadsheets, Zip
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="sr-only"
          accept={Array.from(ALLOWED_TYPES).join(',')}
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {/* Active upload queue */}
      <AnimatePresence>
        {queue.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className={cn(
              'rounded-xl border p-3',
              item.status === 'error'
                ? 'border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-500/10'
                : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
            )}
          >
            <div className="flex items-center gap-2.5">
              {item.status === 'uploading' && (
                <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-brand-500" />
              )}
              {item.status === 'done' && (
                <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500">
                  <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 10 8">
                    <path d="M1 4l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
              {item.status === 'error' && <X className="h-4 w-4 flex-shrink-0 text-red-500" />}

              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-300">
                  {item.file.name}
                </p>
                {item.status === 'error' && (
                  <p className="text-[10px] text-red-500">{item.error}</p>
                )}
                {item.status === 'uploading' && (
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <motion.div
                      className="h-full rounded-full bg-brand-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${item.progress.percent}%` }}
                      transition={{ ease: 'linear' }}
                    />
                  </div>
                )}
              </div>

              <span className="flex-shrink-0 text-[10px] text-slate-400">
                {item.status === 'uploading'
                  ? `${item.progress.percent}%`
                  : formatBytes(item.file.size)}
              </span>

              {item.status === 'error' && (
                <button
                  onClick={() => setQueue((prev) => prev.filter((q) => q.id !== item.id))}
                  className="ml-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Existing attachments */}
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
        </div>
      ) : attachments.length === 0 ? (
        <p className="py-2 text-center text-xs text-slate-400">No attachments yet.</p>
      ) : (
        <AnimatePresence initial={false}>
          <div className="space-y-2">
            {attachments.map((attachment) => {
              const isImage = attachment.contentType.startsWith('image/');
              const Icon = getFileIcon(attachment.contentType);
              const iconColor = getFileIconColor(attachment.contentType);
              const isDeleting = deletingId === attachment._id;
              const isOwner = attachment.uploadedBy._id === user?._id;

              return (
                <motion.div
                  key={attachment._id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-2.5 transition-colors hover:border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50 dark:hover:border-slate-700 dark:hover:bg-slate-800"
                >
                  {/* Thumbnail or icon */}
                  {isImage ? (
                    <a
                      href={attachment.publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-lg"
                    >
                      <img
                        src={attachment.publicUrl}
                        alt={attachment.filename}
                        className="h-full w-full object-cover"
                      />
                    </a>
                  ) : (
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700">
                      <Icon className={cn('h-4 w-4', iconColor)} />
                    </div>
                  )}

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <a
                      href={attachment.publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs font-medium text-slate-800 hover:text-brand-600 dark:text-slate-200 dark:hover:text-brand-400"
                    >
                      <span className="truncate">{attachment.filename}</span>
                      <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
                    </a>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-400">
                      <Avatar
                        name={attachment.uploadedBy.name}
                        src={attachment.uploadedBy.avatar}
                        size="xs"
                        className="h-3.5 w-3.5"
                      />
                      <span>{attachment.uploadedBy.name}</span>
                      <span>·</span>
                      <span>{formatBytes(attachment.size)}</span>
                      <span>·</span>
                      <span>{formatRelative(attachment.createdAt)}</span>
                    </div>
                  </div>

                  {/* Delete (own files only) */}
                  {isOwner && (
                    <button
                      onClick={() => handleDelete(attachment)}
                      disabled={isDeleting}
                      className="flex-shrink-0 rounded-lg p-1 text-slate-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:text-slate-600 dark:hover:bg-red-500/10 disabled:cursor-not-allowed"
                      title="Delete attachment"
                    >
                      {isDeleting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
};
