import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, isPast } from 'date-fns';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

// ── Timezone-aware date formatting ──────────────────────────────────────────
// All dates are stored as absolute UTC instants; how they're *displayed* depends
// on the signed-in user's chosen timezone. We keep that timezone in a module
// variable (defaulting to the browser's) so the existing formatDate()/etc. call
// sites stay unchanged while honouring the user's preference.

let _userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
let _userLocale: string | undefined; // undefined = browser default

/** Set the locale used for date/number formatting (driven by the active i18n language). */
export const setUserLocale = (locale?: string | null): void => {
  _userLocale = locale || undefined;
};

export const setUserTimeZone = (tz?: string | null): void => {
  if (!tz) return;
  try {
    // Throws for an invalid IANA zone — guard so a bad value can't break rendering.
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    _userTimeZone = tz;
  } catch {
    /* keep current */
  }
};

export const getUserTimeZone = (): string => _userTimeZone;

/** 'YYYY-MM-DD' for a date as seen in the active timezone (for day comparisons). */
export const dateKeyInTz = (date: string | Date, tz: string = _userTimeZone): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(date));

export const formatDate = (date: string | Date | null): string => {
  if (!date) return '';
  const d = new Date(date);
  const key = dateKeyInTz(d);
  if (key === dateKeyInTz(new Date())) return 'Today';
  if (key === dateKeyInTz(new Date(Date.now() + 86_400_000))) return 'Tomorrow';
  return new Intl.DateTimeFormat(_userLocale, {
    timeZone: _userTimeZone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
};

export const formatRelative = (date: string | Date): string => {
  // Relative durations ("3 hours ago") are timezone-independent.
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
    'from-brand-500 to-brand-600',
    'from-blue-500 to-cyan-600',
    'from-emerald-500 to-teal-600',
    'from-orange-500 to-red-600',
    'from-pink-500 to-rose-600',
    'from-brand-500 to-blue-600',
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
    label: `Active · ${new Intl.DateTimeFormat(_userLocale, {
      timeZone: _userTimeZone,
      month: 'short',
      day: 'numeric',
    }).format(new Date(lastSeenAt))}`,
    isActive: false,
  };
};
