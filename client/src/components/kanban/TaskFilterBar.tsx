import { Search, X } from 'lucide-react';
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

const DUE_PILLS: { value: Exclude<TaskFilters['dueDateFilter'], 'all'>; label: string }[] = [
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'no-date', label: 'No date' },
];

export const TaskFilterBar = ({ filters, onChange, members, totalCount, filteredCount }: Props) => {
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

  const toggleDue = (val: Exclude<TaskFilters['dueDateFilter'], 'all'>) => {
    onChange({ ...filters, dueDateFilter: filters.dueDateFilter === val ? 'all' : val });
  };

  const clearAll = () => onChange(DEFAULT_FILTERS);

  return (
    <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-100 bg-white/80 px-4 py-2 backdrop-blur-sm scrollbar-none dark:border-slate-800 dark:bg-slate-900/80">

      {/* ── Search ──────────────────────────────────────────────── */}
      <div className="relative flex-shrink-0">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search tasks…"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="h-8 w-48 rounded-lg border border-slate-200 bg-transparent pl-8 pr-7 text-xs text-slate-800 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
        {filters.search && (
          <button
            onClick={() => onChange({ ...filters, search: '' })}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* divider */}
      <div className="h-5 w-px flex-shrink-0 bg-slate-200 dark:bg-slate-700" />

      {/* ── Priority pills ──────────────────────────────────────── */}
      <div className="flex flex-shrink-0 items-center gap-1">
        {PRIORITIES.map((p) => {
          const cfg = PRIORITY_CONFIG[p];
          const active = filters.priorities.includes(p);
          return (
            <button
              key={p}
              onClick={() => togglePriority(p)}
              title={cfg.label}
              className={cn(
                'flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-all',
                active
                  ? 'border-transparent text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-600'
              )}
              style={active ? { backgroundColor: cfg.color, borderColor: cfg.color } : {}}
            >
              <span
                className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                style={{ backgroundColor: active ? 'rgba(255,255,255,0.75)' : cfg.color }}
              />
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* divider */}
      {members.length > 0 && (
        <div className="h-5 w-px flex-shrink-0 bg-slate-200 dark:bg-slate-700" />
      )}

      {/* ── Assignee avatars ───────────────────────────────────── */}
      {members.length > 0 && (
        <div className="flex flex-shrink-0 items-center gap-1">
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
                    ? 'ring-2 ring-brand-500 ring-offset-1 ring-offset-white dark:ring-offset-slate-900'
                    : 'opacity-50 hover:opacity-90'
                )}
              >
                <Avatar name={m.name} src={m.avatar} size="xs" />
              </button>
            );
          })}
        </div>
      )}

      {/* divider */}
      <div className="h-5 w-px flex-shrink-0 bg-slate-200 dark:bg-slate-700" />

      {/* ── Due date pills ─────────────────────────────────────── */}
      <div className="flex flex-shrink-0 items-center gap-1">
        {DUE_PILLS.map((o) => {
          const active = filters.dueDateFilter === o.value;
          return (
            <button
              key={o.value}
              onClick={() => toggleDue(o.value)}
              className={cn(
                'flex h-7 items-center rounded-full border px-2.5 text-xs font-medium transition-all',
                active
                  ? 'border-brand-300 bg-brand-50 text-brand-600 shadow-sm dark:border-brand-700 dark:bg-brand-500/10 dark:text-brand-400'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-600'
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {/* ── Spacer ────────────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── Result count + Clear ──────────────────────────────── */}
      {isFiltered && (
        <div className="flex flex-shrink-0 items-center gap-2">
          <span className="text-xs tabular-nums text-slate-400 dark:text-slate-500">
            {filteredCount} / {totalCount}
          </span>
          <button
            onClick={clearAll}
            className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-600"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        </div>
      )}
    </div>
  );
};
