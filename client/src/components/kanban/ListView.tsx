import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, Calendar, MessageSquare, Paperclip, Inbox } from 'lucide-react';
import { Task, TASK_STATUSES, PRIORITY_CONFIG } from '@/types';
import { AvatarGroup } from '@/components/ui/Avatar';
import { useUIStore } from '@/store/uiStore';
import { formatDate, isOverdue, cn } from '@/lib/utils';

type SortKey = 'title' | 'status' | 'priority' | 'dueDate';
type SortDir = 'asc' | 'desc';

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const STATUS_ORDER: Record<string, number> = { todo: 0, in_progress: 1, review: 2, done: 3 };

interface Props {
  filteredTaskIds: Set<string> | null;
  tasks: Record<string, Task>;
}

export const ListView = ({ filteredTaskIds, tasks }: Props) => {
  const { openTaskDetail } = useUIStore();
  const [sortKey, setSortKey] = useState<SortKey>('status');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedTasks = useMemo(() => {
    let list = Object.values(tasks).filter((t) => !t.isArchived);
    if (filteredTaskIds) list = list.filter((t) => filteredTaskIds.has(t._id));

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'status':
          cmp = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
          break;
        case 'priority':
          cmp = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
          break;
        case 'dueDate':
          if (!a.dueDate && !b.dueDate) cmp = 0;
          else if (!a.dueDate) cmp = 1;
          else if (!b.dueDate) cmp = -1;
          else cmp = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [tasks, filteredTaskIds, sortKey, sortDir]);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronDown className="h-3 w-3 opacity-30" />;
    return sortDir === 'asc'
      ? <ChevronUp className="h-3 w-3 text-brand-500" />
      : <ChevronDown className="h-3 w-3 text-brand-500" />;
  };

  const headerCls = 'flex items-center gap-1 cursor-pointer select-none text-[10px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors';

  if (sortedTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 rounded-2xl bg-slate-100 p-5 dark:bg-slate-800">
          <Inbox className="h-7 w-7 text-slate-400" />
        </div>
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">No tasks match your filters</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-4">
      {/* Sticky header row */}
      <div className="sticky top-0 z-10 mb-1 flex items-center gap-4 rounded-xl bg-slate-50/90 px-4 py-2 backdrop-blur-sm dark:bg-slate-900/90 border border-slate-100 dark:border-slate-800">
        <span className="w-14 flex-shrink-0 text-[10px] font-semibold uppercase tracking-wider text-slate-400">#</span>
        <button className={cn(headerCls, 'flex-1 min-w-0')} onClick={() => handleSort('title')}>
          Title <SortIcon col="title" />
        </button>
        <button className={cn(headerCls, 'w-28 flex-shrink-0')} onClick={() => handleSort('status')}>
          Status <SortIcon col="status" />
        </button>
        <button className={cn(headerCls, 'w-20 flex-shrink-0')} onClick={() => handleSort('priority')}>
          Priority <SortIcon col="priority" />
        </button>
        <span className="w-20 flex-shrink-0 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Assignees</span>
        <button className={cn(headerCls, 'w-24 flex-shrink-0')} onClick={() => handleSort('dueDate')}>
          Due <SortIcon col="dueDate" />
        </button>
        <span className="w-24 flex-shrink-0 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Labels</span>
      </div>

      {/* Task rows */}
      <div className="space-y-0.5">
        {sortedTasks.map((task) => {
          const overdue = isOverdue(task.dueDate, task.status);
          const statusInfo = TASK_STATUSES.find((s) => s.id === task.status);
          const priorityCfg = PRIORITY_CONFIG[task.priority];

          return (
            <div
              key={task._id}
              onClick={() => openTaskDetail(task._id)}
              className="group flex cursor-pointer items-center gap-4 rounded-xl border border-transparent px-4 py-2.5 transition-colors hover:border-slate-100 hover:bg-white dark:hover:border-slate-800 dark:hover:bg-slate-800/50"
            >
              {/* Identifier */}
              <span className="w-14 flex-shrink-0 font-mono text-[10px] font-semibold text-slate-400">
                {task.identifier != null ? `#${task.identifier}` : '–'}
              </span>

              {/* Title */}
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate text-sm font-medium text-slate-800 group-hover:text-brand-600 dark:text-slate-100 dark:group-hover:text-brand-400">
                  {task.title}
                </span>
                {(task.commentCount ?? 0) > 0 && (
                  <span className="flex flex-shrink-0 items-center gap-0.5 text-[10px] text-slate-400">
                    <MessageSquare className="h-3 w-3" />{task.commentCount}
                  </span>
                )}
                {(task.attachmentCount ?? 0) > 0 && (
                  <span className="flex flex-shrink-0 items-center gap-0.5 text-[10px] text-slate-400">
                    <Paperclip className="h-3 w-3" />{task.attachmentCount}
                  </span>
                )}
              </div>

              {/* Status */}
              <div className="w-28 flex-shrink-0">
                {statusInfo && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                    style={{ backgroundColor: statusInfo.color }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
                    {statusInfo.label}
                  </span>
                )}
              </div>

              {/* Priority */}
              <div className="w-20 flex-shrink-0">
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{ backgroundColor: priorityCfg.color + '20', color: priorityCfg.color }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: priorityCfg.color }} />
                  {priorityCfg.label}
                </span>
              </div>

              {/* Assignees */}
              <div className="w-20 flex-shrink-0">
                {task.assignees?.length > 0 ? (
                  <AvatarGroup users={task.assignees} max={3} />
                ) : (
                  <span className="text-xs text-slate-300 dark:text-slate-600">–</span>
                )}
              </div>

              {/* Due date */}
              <div className="w-24 flex-shrink-0">
                {task.dueDate ? (
                  <span className={cn(
                    'flex items-center gap-1 text-xs',
                    overdue ? 'font-semibold text-red-500' : 'text-slate-400'
                  )}>
                    <Calendar className="h-3 w-3 flex-shrink-0" />
                    {formatDate(task.dueDate)}
                  </span>
                ) : (
                  <span className="text-xs text-slate-300 dark:text-slate-600">–</span>
                )}
              </div>

              {/* Labels */}
              <div className="flex w-24 flex-shrink-0 flex-wrap gap-1">
                {task.labels?.slice(0, 2).map((label, i) => (
                  <span
                    key={i}
                    className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-white"
                    style={{ backgroundColor: label.color }}
                  >
                    {label.name}
                  </span>
                ))}
                {(task.labels?.length ?? 0) > 2 && (
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                    +{task.labels.length - 2}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
