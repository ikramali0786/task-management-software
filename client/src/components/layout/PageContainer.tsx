import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Shared page shell primitives so every authenticated page follows the same
 * spatial + typographic rhythm: consistent gutters, max-width tiers, and a
 * single canonical page-header treatment (ember icon tile + display title).
 */

type Width = 'narrow' | 'default' | 'wide' | 'full';

const widths: Record<Width, string> = {
  narrow: 'max-w-2xl', // forms, settings
  default: 'max-w-4xl', // standard content
  wide: 'max-w-5xl', // timelines, lists
  full: 'max-w-7xl', // dashboards, dense grids
};

interface PageContainerProps {
  children: React.ReactNode;
  width?: Width;
  className?: string;
}

export const PageContainer = ({ children, width = 'default', className }: PageContainerProps) => (
  <div className={cn('mx-auto w-full p-6 md:p-8', widths[width], className)}>{children}</div>
);

interface PageHeaderProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Right-aligned actions (buttons, filters, badges). */
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader = ({ icon: Icon, title, description, actions, className }: PageHeaderProps) => (
  <div className={cn('mb-6 flex flex-wrap items-start justify-between gap-4', className)}>
    <div className="flex items-center gap-3">
      {Icon && (
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/10">
          <Icon className="h-5 w-5 text-brand-500" />
        </div>
      )}
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
    </div>
    {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
  </div>
);
