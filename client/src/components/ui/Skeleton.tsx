import { cn } from '@/lib/utils';

/** Shimmering placeholder block — the canonical loading primitive. */
export const Skeleton = ({ className }: { className?: string }) => (
  <div
    className={cn('animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800/70', className)}
    aria-hidden="true"
  />
);
