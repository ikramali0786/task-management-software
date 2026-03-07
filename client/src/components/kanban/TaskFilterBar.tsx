import { useState } from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TaskPriority, User, PRIORITY_CONFIG } from '@/types';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

export interface TaskFilters {
  search: string;
  priorities: TaskPriority[];
  assigneeIds: string[];
  dueDateFilter: 'all' | 'overdue' | 'today' | 'week' | 'no-date';
}

export const DEFAULT_FILTERS: TaskFilters = {
  search: '',
  priorities: [],
  assigneeIds: [],
  dueDateFilter: 'all',
};

interface Props {
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
  members: User[];
  totalCount: number;
  filteredCount: number;
}

const PRIORITIES: TaskPriority[] = ['urgent', 'high', 'medium', 'low'];

const DUE_OPTIONS: { value: TaskFilters['dueDateFilter']; label: string }[] = [
  { value: 'all', label: 'Any date' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Due today' },
  { value: 'week', label: 'Due this week' },
  { value: 'no-date', label: 'No due date' },
];

export const TaskFilterBar = ({ filters, onChange, members, totalCount, filteredCount }: Props) => {
  const [expanded, setExpanded] = useState(false);

  const isFiltered =
    filters.search.trim() !== '' ||
    filters.priorities.length > 0 ||
    filters.assigneeIds.length > 0 ||
    filters.dueDateFilter !== 'all';

  const togglePriority = (p: TaskPriority) => {
    const next = filters.priorities.includes(p)
      ? filters.priorities.filter((x) => x !== p)
      : [...filters.priorities, p];
    onChange({ ...filters, priorities: next });
  };

  const toggleAssignee = (id: string) => {
    const next = filters.assigneeIds.includes(id)
      ? filters.assigneeIds.filter((x) => x !== id)
      : [...filters.assigneeIds, id];
    onChange({ ...filters, assigneeIds: next });
  };

  const clearAll = () => onChange(DEFAULT_FILTERS);

  return (
    <div className="flex flex-col gap-2 border-b border-slate-100 bg-white/80 px-6 py-3 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80">
      {/* Top row: search + filter toggle + clear */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search tasks…"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          {filters.search && (
            <button
              onClick={() => onChange({ ...filters, search: '' })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Expand filters button */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            'flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors',
            expanded || isFiltered
              ? 'border-brand-300 bg-brand-50 text-brand-600 dark:border-brand-700 dark:bg-brand-500/10 dark:text-brand-400'
              : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
          )}
        >
          <SlidersHorizontal className="h-3 w-3" />
          Filters
          {isFiltered && (
            <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white">
              {filters.priorities.length + filters.assigneeIds.length + (filters.dueDateFilter !== 'all' ? 1 : 0)}
            </span>
          )}
        </button>

        {/* Result count + clear */}
        <div className="ml-auto flex items-center gap-3">
          {isFiltered && (
            <span className="text-xs text-slate-400">
              {filteredCount} of {totalCount} tasks
            </span>
          )}
          {isFiltered && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X className="h-3 w-3" />
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Expanded filters row */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-4 pb-1 pt-1">
              {/* Priority chips */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-slate-400">Priority:</span>
                {PRIORITIES.map((p) => {
                  const cfg = PRIORITY_CONFIG[p];
                  const active = filters.priorities.includes(p);
                  return (
                    <button
                      key={p}
                      onClick={() => togglePriority(p)}
                      className={cn(
                        'flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all',
                        active
                          ? 'border-transparent text-white'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                      )}
                      style={active ? { backgroundColor: cfg.color, borderColor: cfg.color } : {}}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: active ? 'rgba(255,255,255,0.8)' : cfg.color }}
                      />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>

              {/* Divider */}
              <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />

              {/* Assignee avatars */}
              {members.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-slate-400">Assignee:</span>
                  {members.map((m) => {
                    const active = filters.assigneeIds.includes(m._id);
                    return (
                      <button
                        key={m._id}
                        onClick={() => toggleAssignee(m._id)}
                        title={m.name}
                        className={cn(
                          'rounded-full transition-all',
                          active
                            ? 'ring-2 ring-brand-500 ring-offset-1'
                            : 'opacity-50 hover:opacity-100'
                        )}
                      >
                        <Avatar name={m.name} src={m.avatar} size="xs" />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Divider */}
              <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />

              {/* Due date filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-slate-400">Due:</span>
                <select
                  value={filters.dueDateFilter}
                  onChange={(e) =>
                    onChange({ ...filters, dueDateFilter: e.target.value as TaskFilters['dueDateFilter'] })
                  }
                  className="h-6 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  {DUE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
