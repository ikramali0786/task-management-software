import { FileText, ImageIcon, File } from 'lucide-react';

/** Shared constants, palette, and pure helpers for the Chatbots feature. */

export const EMOJI_PICKS = [
  '🤖','🧠','💡','📊','📝','🚀','🔍','⚡','🎯','💬',
  '🛠️','📋','🗂️','✅','💻','📈','🔥','🌟','🎨','🔧',
];

// Curated, on-brand bot palette — ember leads, the rest are harmonious accents
// for differentiating multiple bots. No deceptive duplicates.
export const COLOR_PICKS = ['ember','amber','rose','pink','violet','sky','teal','emerald'];

export const MODEL_OPTIONS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (fast)' },
  { value: 'gpt-4o', label: 'GPT-4o (best)' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (legacy)' },
];

export const COLOR_CLASSES: Record<string, { bg: string; text: string; ring: string }> = {
  ember:  { bg: 'bg-brand-500',   text: 'text-brand-600 dark:text-brand-400',    ring: 'ring-brand-400' },
  amber:  { bg: 'bg-amber-500',    text: 'text-amber-600 dark:text-amber-400',    ring: 'ring-amber-400' },
  rose:   { bg: 'bg-rose-500',     text: 'text-rose-600 dark:text-rose-400',      ring: 'ring-rose-400' },
  pink:   { bg: 'bg-pink-500',     text: 'text-pink-600 dark:text-pink-400',      ring: 'ring-pink-400' },
  violet: { bg: 'bg-violet-500',   text: 'text-violet-600 dark:text-violet-400',  ring: 'ring-violet-400' },
  sky:    { bg: 'bg-sky-500',      text: 'text-sky-600 dark:text-sky-400',        ring: 'ring-sky-400' },
  teal:   { bg: 'bg-teal-500',     text: 'text-teal-600 dark:text-teal-400',      ring: 'ring-teal-400' },
  emerald:{ bg: 'bg-emerald-500',  text: 'text-emerald-600 dark:text-emerald-400',ring: 'ring-emerald-400' },
  // Legacy aliases — bots created before the palette refresh.
  indigo: { bg: 'bg-brand-500',   text: 'text-brand-600 dark:text-brand-400',    ring: 'ring-brand-400' },
  orange: { bg: 'bg-brand-500',   text: 'text-brand-600 dark:text-brand-400',    ring: 'ring-brand-400' },
  blue:   { bg: 'bg-sky-500',      text: 'text-sky-600 dark:text-sky-400',        ring: 'ring-sky-400' },
};

export const ACCEPTED_FILE_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain', 'text/csv',
].join(',');

export function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return ImageIcon;
  if (mimeType === 'application/pdf') return FileText;
  return File;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── AI-generated file download ────────────────────────────────────────────────

const DOWNLOADABLE_LANGS: Record<string, { ext: string; mime: string }> = {
  csv:  { ext: 'csv',  mime: 'text/csv' },
  json: { ext: 'json', mime: 'application/json' },
  xml:  { ext: 'xml',  mime: 'application/xml' },
  yaml: { ext: 'yaml', mime: 'text/yaml' },
  yml:  { ext: 'yml',  mime: 'text/yaml' },
  tsv:  { ext: 'tsv',  mime: 'text/tab-separated-values' },
  txt:  { ext: 'txt',  mime: 'text/plain' },
  md:   { ext: 'md',   mime: 'text/markdown' },
  html: { ext: 'html', mime: 'text/html' },
};

export type ContentSegment =
  | { type: 'text'; text: string }
  | { type: 'code'; lang: string; code: string; ext: string; mime: string };

export function parseAssistantContent(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const regex = /```(\w+)?\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim();
      if (text) segments.push({ type: 'text', text });
    }
    const lang = (match[1] || '').toLowerCase();
    const code = (match[2] || '').trim();
    const dlInfo = DOWNLOADABLE_LANGS[lang];
    if (dlInfo && code) {
      segments.push({ type: 'code', lang, code, ext: dlInfo.ext, mime: dlInfo.mime });
    } else {
      // Non-downloadable code block — keep as raw text
      segments.push({ type: 'text', text: match[0] });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim();
    if (text) segments.push({ type: 'text', text });
  }

  // If nothing was parsed (no code blocks at all), return a single text segment
  if (segments.length === 0 && content.trim()) {
    segments.push({ type: 'text', text: content });
  }

  return segments;
}

export function triggerDownload(code: string, ext: string, mime: string) {
  const blob = new Blob([code], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ai-generated.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
