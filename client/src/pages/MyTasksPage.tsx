import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, CheckCircle2, Clock, AlertTriangle, CheckSquare,
  ChevronDown, ChevronRight, Inbox, Calendar,
} from 'lucide-react';
import { useTaskStore } from '@/store/taskStore';
import { useTeamStore } from '@/store/teamStore';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { TaskDetailModal } from '@/components/tasks/TaskDetailModal';
import { PriorityBadge } from '@/components/ui/Badge';
import { AvatarGroup } from '@/components/ui/Avatar';
import { cn, formatDate, isOverdue } from '@/lib/utils';
import { Task, TaskPriority, TaskStatus, TASK_STATUSES, PRIORITY_CONFIG } from '@/types';

/* ─── Helpers ───────────────────────────────────────────────────────────── */
const isDueSoon = (t: Task) => {
  if (!t.dueDate || t.status === 'done') return false;
  const diff = (new Date(t.dueDate).getTime() - Date.now()) / 86_400_000;
  return diff >= 0 && diff <= 2;
};

const isOverdueTask = (t: Task) =>
  !!t.dueDate && t.status !== 'done' && new Date(t.dueDate) < new Date();

/* ─── Skeleton ───────────────────────────────────────────────────────────── */
const SkeletonRow = () => (
  <div className="flex items-center gap-3 rounded-xl px-4 py-3 animate-pulse">
    <div className="h-2.5 w-2.5 rounded-full bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
    <div className="h-3 flex-1 rounded bg-slate-200 dark:bg-slate-700" />
    <div className="h-5 w-16 rounded-full bg-slate-200 dark:bg-slate-700" />
    <div className="h-3 w-20 rounded bg-slate-200 dark:bg-slate-700" />
  </div>
);

/* ─── Empty state ────────────────────────────────────────────────────────── */
const EmptyState = ({ icon: Icon, message, sub }: { icon: React.ElementType; message: string; sub?: string }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="mb-4 rounded-2xl bg-slate-100 p-5 dark:bg-slate-800">
      <Icon className="h-7 w-7 text-slate-400" />
    </div>
    <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">{message}</p>
    {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
  </div>
);

/* ─── Task row ───────────────────────────────────────────────────────────── */
interface TaskRowProps { task: Task; onClick: () => void; }
const TaskRow = ({ task, onClick }: TaskRowProps) => {
  const overdue = isOverdueTask(task);
  const statusInfo = TASK_STATUSES.find((s) => s.id === task.status);
  const completedSubtasks = task.subtasks?.filter((s) => s.completed).length ?? 0;
  const totalSubtasks = task.subtasks?.length ?? 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -6 }}
      onClick={onClick}
      className="group flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
    >
      {/* Status dot */}
      <span
        className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
        style={{ backgroundColor: statusInfo?.color ?? '#94a3b8' }}
      />

      {/* Identifier */}
      {task.identifier != null && (
        <span className="flex-shrink-0 rounded bg-slate-100 px-1 py-0.5 font-mono text-[9px] font-semibold text-slate-400 dark:bg-slate-700 dark:text-slate-500">
          #{task.identifier}
        </span>
      )}

      {/* Title */}
      <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 transition-colors group-hover:text-brand-600 dark:text-slate-100 dark:group-hover:text-brand-400">
        {task.title}
      </p>

      {/* Priority badge */}
      <div className="flex-shrink-0">
        <PriorityBadge priority={task.priority} />
      </div>

      {/* Due date */}
      {task.dueDate && (
        <span className={cn(
          'flex flex-shrink-0 items-center gap-1 text-xs',
          overdue ? 'font-semibold text-red-500' : 'text-slate-400'
        )}>
          <Calendar className="h-3 w-3" />
          {overdue && 'Overdue · '}
          {formatDate(task.dueDate)}
        </span>
      )}

      {/* Subtask progress */}
      {totalSubtasks > 0 && (
        <span className="flex-shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-400">
          {completedSubtasks}/{totalSubtasks}
        </span>
      )}

      {/* Assignees */}
      {task.assignees?.length > 0 && (
        <div className="flex-shrink-0">
          <AvatarGroup users={task.assignees} max={3} />
        </div>
      )}
    </motion.div>
  );
};

/* ─── Collapsible status group ───────────────────────────────────────────── */
interface StatusGroupProps {
  status: TaskStatus;
  tasks: Task[];
  onTaskClick: (id: string) => void;
}
const StatusGroup = ({ status, tasks, onTaskClick }: StatusGroupProps) => {
  const [open, setOpen] = useState(true);
  const statusInfo = TASK_STATUSES.find((s) => s.id === status)!;
  if (tasks.length === 0) return null;
  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
      >
        <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: statusInfo.color }} />
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{statusInfo.label}</span>
        <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-400">
          {tasks.length}
        </span>
        <div className="flex-1" />
        {open ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            {tasks.map((task) => (
              <TaskRow key={task._id} task={task} onClick={() => onTaskClick(task._id)} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ─── Main page ──────────────────────────────────────────────────────────── */
type Tab = 'active' | 'due_soon' | 'overdue' | 'done';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'active', label: 'Active', icon: Clock },
  { id: 'due_soon', label: 'Due Soon', icon: AlertTriangle },
  { id: 'overdue', label: 'Overdue', icon: AlertTriangle },
  { id: 'done', label: 'Done', icon: CheckCircle2 },
];

const PRIORITIES: TaskPriority[] = ['urgent', 'high', 'medium', 'low'];
const ACTIVE_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'review'];

export const MyTasksPage = () => {
  const { user } = useAuthStore();
  const { activeTeam } = useTeamStore();
  const { tasks, fetchTasks, isLoading, activeTeamId } = useTaskStore();
  const { openTaskDetail, activeModal, activeTaskId, closeModal } = useUIStore();

  const [tab, setTab] = useState<Tab>('active');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority[]>([]);

  // Fetch tasks on mount if needed
  useEffect(() => {
    if (activeTeam && activeTeamId !== activeTeam._id) {
      fetchTasks(activeTeam._id);
    }
  }, [activeTeam?._id]);

  const myTasks = useMemo(() => {
    if (!user) return [];
    return Object.values(tasks).filter(
      (t) => !t.isArchived && t.assignees?.some((a) => a._id === user._id)
    );
  }, [tasks, user?._id]);

  const applyPriorityFilter = (list: Task[]) =>
    priorityFilter.length === 0 ? list : list.filter((t) => priorityFilter.includes(t.priority));

  const tabTasks = useMemo(() => {
    switch (tab) {
      case 'active':   return applyPriorityFilter(myTasks.filter((t) => ACTIVE_STATUSES.includes(t.status)));
      case 'due_soon': return applyPriorityFilter(myTasks.filter(isDueSoon));
      case 'overdue':  return applyPriorityFilter(myTasks.filter(isOverdueTask));
      case 'done':     return applyPriorityFilter(myTasks.filter((t) => t.status === 'done'));
      default: return [];
    }
  }, [myTasks, tab, priorityFilter]);

  const togglePriority = (p: TaskPriority) =>
    setPriorityFilter((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );

  const tabCounts = useMemo(() => ({
    active:   myTasks.filter((t) => ACTIVE_STATUSES.includes(t.status)).length,
    due_soon: myTasks.filter(isDueSoon).length,
    overdue:  myTasks.filter(isOverdueTask).length,
    done:     myTasks.filter((t) => t.status === 'done').length,
  }), [myTasks]);

  // Group active tasks by status
  const activeGrouped = useMemo(() => {
    if (tab !== 'active') return null;
    const groups: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], review: [], done: [] };
    for (const t of tabTasks) {
      if (groups[t.status]) groups[t.status].push(t);
    }
    return groups;
  }, [tabTasks, tab]);

  if (!activeTeam) {
    return (
      <EmptyState
        icon={User}
        message="No team selected"
        sub="Select or create a team to view your tasks"
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-brand-50 p-2.5 dark:bg-brand-500/10">
          <User className="h-5 w-5 text-brand-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Tasks</h1>
          <p className="text-sm text-slate-400">{myTasks.length} task{myTasks.length !== 1 ? 's' : ''} assigned to you</p>
        </div>
        <span className="ml-2 rounded-full bg-brand-100 px-3 py-1 text-sm font-semibold text-brand-600 dark:bg-brand-500/20 dark:text-brand-400">
          {tabTasks.length}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800 w-fit">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
              tab === id
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            )}
          >
            {label}
            {tabCounts[id] > 0 && (
              <span className={cn(
                'rounded-full px-1.5 py-0.5 text-[9px] font-bold',
                tab === id
                  ? 'bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400'
                  : 'bg-slate-200 text-slate-500 dark:bg-slate-600 dark:text-slate-400'
              )}>
                {tabCounts[id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Priority filter pills */}
      <div className="flex flex-wrap gap-1.5">
        {PRIORITIES.map((p) => {
          const cfg = PRIORITY_CONFIG[p];
          const active = priorityFilter.includes(p);
          return (
            <button
              key={p}
              onClick={() => togglePriority(p)}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
                active
                  ? 'border-transparent text-white shadow-sm'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-300'
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
        {priorityFilter.length > 0 && (
          <button
            onClick={() => setPriorityFilter([])}
            className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-400 transition-colors hover:text-slate-600 dark:border-slate-600 dark:bg-slate-700/60"
          >
            Clear
          </button>
        )}
      </div>

      {/* Task list */}
      <div className="card">
        {isLoading ? (
          <div className="space-y-1">
            {[1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)}
          </div>
        ) : tabTasks.length === 0 ? (
          <EmptyState
            icon={tab === 'done' ? CheckSquare : Inbox}
            message={
              tab === 'active' ? 'No active tasks assigned to you'
              : tab === 'due_soon' ? 'Nothing due in the next 2 days'
              : tab === 'overdue' ? 'No overdue tasks — great work!'
              : 'No completed tasks yet'
            }
            sub={
              tab === 'active' ? 'Ask a teammate to assign you some tasks'
              : tab === 'done' ? 'Complete some tasks to see them here'
              : undefined
            }
          />
        ) : tab === 'active' && activeGrouped ? (
          <div>
            {ACTIVE_STATUSES.map((status) => (
              <StatusGroup
                key={status}
                status={status}
                tasks={activeGrouped[status]}
                onTaskClick={openTaskDetail}
              />
            ))}
          </div>
        ) : (
          <div>
            {tabTasks.map((task) => (
              <TaskRow key={task._id} task={task} onClick={() => openTaskDetail(task._id)} />
            ))}
          </div>
        )}
      </div>

      {/* Task detail modal */}
      <AnimatePresence>
        {activeModal === 'task-detail' && activeTaskId && (
          <TaskDetailModal taskId={activeTaskId} onClose={closeModal} />
        )}
      </AnimatePresence>
    </div>
  );
};
