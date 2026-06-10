import { motion } from 'framer-motion';
import { Bot, X } from 'lucide-react';
import { ChatMessageAttachment } from '@/types';
import { cn } from '@/lib/utils';
import { getFileIcon, formatBytes } from '@/lib/chatbotUtils';

/** Small presentational pieces for the chat UI. */

export const TypingIndicator = () => (
  <div className="flex items-end gap-2">
    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700">
      <Bot className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
    </div>
    <div className="rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-3 dark:bg-slate-800">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-500"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }}
          />
        ))}
      </div>
    </div>
  </div>
);

interface AttachmentChipProps {
  file: File;
  previewUrl: string | null;
  onRemove: () => void;
}

export const AttachmentChip = ({ file, previewUrl, onRemove }: AttachmentChipProps) => {
  const isImage = file.type.startsWith('image/');
  const Icon = getFileIcon(file.type);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 4 }}
      className="relative flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 pr-8 shadow-sm dark:border-slate-700 dark:bg-slate-800"
    >
      {isImage && previewUrl ? (
        <img src={previewUrl} alt={file.name} className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" />
      ) : (
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-500/10">
          <Icon className="h-5 w-5 text-brand-500" />
        </div>
      )}
      <div className="min-w-0">
        <p className="max-w-[160px] truncate text-xs font-medium text-slate-700 dark:text-slate-200">{file.name}</p>
        <p className="text-[10px] text-slate-400">{formatBytes(file.size)}</p>
      </div>
      <button
        onClick={onRemove}
        className="absolute right-1.5 top-1.5 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
      >
        <X className="h-3 w-3" />
      </button>
    </motion.div>
  );
};

export const MessageAttachment = ({ attachment, isUser }: { attachment: ChatMessageAttachment; isUser: boolean }) => {
  const isImage = attachment.mimeType.startsWith('image/');
  const Icon = getFileIcon(attachment.mimeType);

  if (isImage && attachment.previewUrl) {
    return (
      <div className="mb-2">
        <img src={attachment.previewUrl} alt={attachment.name} className="max-h-56 max-w-full rounded-xl object-contain" />
      </div>
    );
  }

  return (
    <div className={cn('mb-2 flex items-center gap-2 rounded-xl px-3 py-2 text-xs', isUser ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-700')}>
      <Icon className="h-4 w-4 flex-shrink-0 opacity-80" />
      <span className="max-w-[200px] truncate font-medium">{attachment.name}</span>
    </div>
  );
};
