import { useState, useRef, useEffect } from 'react';
import {
  Search, X, SlidersHorizontal, ChevronDown,
  CheckSquare, RefreshCw,
} from 'lucide-react';
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
  teamName: string;
  onRefresh: () => void;
  selectionMode: boolean;
  onToggleSelection: () => void;
}

const PRIORITIES: TaskPriority[] = ['urgent', 'high', 'medium', 'low'];

const DUE_PILLS: { value: Exclude<TaskFilters['dueDateFilter'], 'all'>; label: string }[] = [
  { value: 'overdue', label: 'Overdue' },
  { value: 'today',   label: 'Today'   },
  { value: 'week',    label: 'This week' },
  { value: 'no-date', label: 'No date' },
];

export const TaskFilterBar = ({
  filters, onChange, members, totalCount, filteredCount,
  teamName, onRefresh, selectionMode, onToggleSelection,
}: Props) => {
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!filterOpen) return;
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [filterOpen]);

  const activeFilterCount =
    filters.priorities.length +
    filters.assigneeIds.length +
    (filters.dueDateFilter !== 'all' ? 1 : 0);

  const isFiltered = filters.search.trim() !== '' || activeFilterCount > 0;

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
    <div className="relative z-20 flex flex-shrink-0 items-center gap-3 border-b border-slate-100 bg-white/80 px-6 py-2.5 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80">

      {/* ── Team / board label ─────────────────────────────────────── */}
      <div className="flex flex-shrink-0 items-center gap-2 pr-1">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{teamName}</span>
        <span className="text-slate-300 dark:text-slate-600">·</span>
        <span className="text-xs text-slate-400 dark:text-slate-500">Board</span>
      </div>

      {/* thin vertical rule */}
      <div className="h-5 w-px flex-shrink-0 bg-slate-200 dark:bg-slate-700" />

      {/* ── Search ─────────────────────────────────────────────────── */}
      <div className="relative flex-1" style={{ maxWidth: 260 }}>
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search tasks…"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50/60 pl-8 pr-7 text-xs text-slate-800 placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-800"
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

      {/* ── Filters popover button ─────────────────────────────────── */}
      <div className="relative flex-shrink-0" ref={filterRef}>
        <button
          onClick={() => setFilterOpen((v) => !v)}
          className={cn(
            'flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors',
            filterOpen || activeFilterCount > 0
              ? 'border-brand-300 bg-brand-50 text-brand-600 dark:border-brand-700/60 dark:bg-brand-500/10 dark:text-brand-400'
              : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-600'
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
          <ChevronDown className={cn('h-3 w-3 opacity-50 transition-transform', filterOpen && 'rotate-180')} />
        </button>

        {/* ── Dropdown panel ───────────────────────────────────────── */}
        {filterOpen && (
          <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-800">

            {/* Priority */}
            <div className="mb-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Priority</p>
              <div className="flex flex-wrap gap-1.5">
                {PRIORITIES.map((p) => {
                  const cfg = PRIORITY_CONFIG[p];
                  const active = filters.priorities.includes(p);
                  return (
                    <button
                      key={p}
                      onClick={() => togglePriority(p)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
                        active
                          ? 'border-transparent text-white shadow-sm'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-300 dark:hover:border-slate-500'
                      )}
                      style={active ? { backgroundColor: cfg.color } : {}}
                    >
                      <span
                        className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: active ? 'rgba(255,255,255,0.8)' : cfg.color }}
                      />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Due date */}
            <div className={cn('mb-4', members.length === 0 && 'mb-0')}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Due date</p>
              <div className="flex flex-wrap gap-1.5">
                {DUE_PILLS.map((o) => {
                  const active = filters.dueDateFilter === o.value;
                  return (
                    <button
                      key={o.value}
                      onClick={() => toggleDue(o.value)}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
                        active
                          ? 'border-brand-300 bg-brand-50 text-brand-600 dark:border-brand-700/60 dark:bg-brand-500/10 dark:text-brand-400'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-300 dark:hover:border-slate-500'
                      )}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Assignee */}
            {members.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Assignee</p>
                <div className="flex flex-wrap gap-1.5">
                  {members.map((m) => {
                    const active = filters.assigneeIds.includes(m._id);
                    return (
                      <button
                        key={m._id}
                        onClick={() => toggleAssignee(m._id)}
                        title={m.name}
                        className={cn(
                          'flex items-center gap-1.5 rounded-full border py-0.5 pl-1 pr-2.5 text-xs font-medium transition-all',
                          active
                            ? 'border-brand-300 bg-brand-50 text-brand-600 dark:border-brand-700/60 dark:bg-brand-500/10 dark:text-brand-400'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-300 dark:hover:border-slate-500'
                        )}
                      >
                        <Avatar name={m.name} src={m.avatar} size="xs" />
                        <span className="max-w-[72px] truncate">{m.name.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Footer: clear all */}
            {activeFilterCount > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-700">
                <button
                  onClick={clearAll}
                  className="flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <X className="h-3 w-3" />
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Filter result count (only when active) ─────────────────── */}
      {isFiltered && (
        <span className="flex-shrink-0 tabular-nums text-xs text-slate-400 dark:text-slate-500">
          {filteredCount} / {totalCount}
        </span>
      )}

      {/* ── Spacer ─────────────────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── Select / Cancel ────────────────────────────────────────── */}
      <button
        onClick={onToggleSelection}
        className={cn(
          'flex h-8 flex-shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors',
          selectionMode
            ? 'border-brand-300 bg-brand-50 text-brand-600 dark:border-brand-700/60 dark:bg-brand-500/10 dark:text-brand-400'
            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-600'
        )}
      >
        {selectionMode ? (
          <>
            <X className="h-3.5 w-3.5" />
            Cancel
          </>
        ) : (
          <>
            <CheckSquare className="h-3.5 w-3.5" />
            Select
          </>
        )}
      </button>

      {/* ── Refresh ────────────────────────────────────────────────── */}
      <button
        onClick={onRefresh}
        title="Refresh board"
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-600"
      >
        <RefreshCw className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
