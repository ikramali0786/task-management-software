import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, format, isToday, isTomorrow, isPast } from 'date-fns';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const formatDate = (date: string | Date | null): string => {
  if (!date) return '';
  const d = new Date(date);
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  return format(d, 'MMM d, yyyy');
};

export const formatRelative = (date: string | Date): string => {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
};

export const isOverdue = (dueDate: string | null, status: string): boolean => {
  if (!dueDate || status === 'done') return false;
  return isPast(new Date(dueDate));
};

export const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export const generateAvatarColor = (name: string): string => {
  const colors = [
    'from-violet-500 to-purple-600',
    'from-blue-500 to-cyan-600',
    'from-emerald-500 to-teal-600',
    'from-orange-500 to-red-600',
    'from-pink-500 to-rose-600',
    'from-indigo-500 to-blue-600',
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
};

export const truncate = (str: string, length: number): string => {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
};

/**
 * Returns a human-readable "last active" string and whether the user is currently active.
 * - Within 5 min  → { label: 'Active now', isActive: true }
 * - Within 1 hour → { label: 'Active · 12 min ago', isActive: false }
 * - Within 24 h   → { label: 'Active · 3 hr ago',  isActive: false }
 * - Older         → { label: 'Active · Jan 5',       isActive: false }
 */
export const formatLastSeen = (
  lastSeenAt: string | Date | null | undefined
): { label: string; isActive: boolean } => {
  if (!lastSeenAt) return { label: 'Never active', isActive: false };

  const diff = Date.now() - new Date(lastSeenAt).getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 5) return { label: 'Active now', isActive: true };
  if (minutes < 60) return { label: `Active · ${minutes} min ago`, isActive: false };
  if (hours < 24) return { label: `Active · ${hours} hr ago`, isActive: false };
  if (days === 1) return { label: 'Active · 1 day ago', isActive: false };
  if (days < 7) return { label: `Active · ${days} days ago`, isActive: false };
  return {
    label: `Active · ${format(new Date(lastSeenAt), 'MMM d')}`,
    isActive: false,
  };
};
