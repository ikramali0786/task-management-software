import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Shared, animated empty state — a soft container fade-up with a springy icon
 * pop. Used across the app so "nothing here yet" always feels intentional.
 */
export const EmptyState = ({ icon: Icon, title, description, action, className }: EmptyStateProps) => (
  <motion.div
    initial={{ opacity: 0, y: 10, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    className={cn('flex flex-col items-center justify-center py-16 text-center', className)}
  >
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.08, type: 'spring', stiffness: 260, damping: 18 }}
      className="mb-4 rounded-2xl bg-slate-100 p-5 dark:bg-slate-800"
    >
      <Icon className="h-7 w-7 text-slate-400" />
    </motion.div>
    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{title}</p>
    {description && <p className="mt-1 max-w-sm text-xs text-slate-400">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </motion.div>
);
