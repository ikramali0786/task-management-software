import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { useTaskStore } from '@/store/taskStore';
import { useUIStore } from '@/store/uiStore';
import { Task, PRIORITY_CONFIG, TASK_STATUSES } from '@/types';
import { cn } from '@/lib/utils';
import { TaskDetailModal } from '@/components/tasks/TaskDetailModal';

// ── Helpers ──────────────────────────────────────────────────────────────────

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay(); // 0 = Sunday
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const CalendarPage = () => {
  const { tasks } = useTaskStore();
  const { activeModal, activeTaskId, openTaskDetail, closeModal } = useUIStore();

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // Group tasks by their due-date key
  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    Object.values(tasks).forEach((task) => {
      if (!task.dueDate) return;
      const key = task.dueDate.slice(0, 10); // "YYYY-MM-DD"
      if (!map[key]) map[key] = [];
      map[key].push(task);
    });
    return map;
  }, [tasks]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };

  const goToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  };

  // Build calendar grid cells
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  const totalWeeks = totalCells / 7; // 4, 5, or 6

  const todayKey = toDateKey(today);

  return (
    <div className="flex h-full flex-col bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center gap-4 border-b border-slate-100 px-6 py-4 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-brand-500" />
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">Calendar</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <span className="min-w-[160px] text-center text-sm font-semibold text-slate-800 dark:text-slate-200">
            {MONTHS[viewMonth]} {viewYear}
          </span>

          <button
            onClick={nextMonth}
            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <button
          onClick={goToday}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          Today
        </button>

        {/* Legend */}
        <div className="ml-auto flex items-center gap-3">
          {TASK_STATUSES.map(({ id, label, color }) => (
            <div key={id} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-slate-400">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Day-of-week headers */}
      <div className="grid flex-shrink-0 grid-cols-7 border-b border-slate-100 dark:border-slate-800">
        {DAYS_OF_WEEK.map((d) => (
          <div key={d} className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid — use inline style for grid-template-rows so rows equally fill available height */}
      <div
        className="grid flex-1 grid-cols-7 overflow-y-auto"
        style={{ gridTemplateRows: `repeat(${totalWeeks}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: totalCells }).map((_, idx) => {
          const dayNum = idx - firstDay + 1;
          const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth;
          const cellDate = isCurrentMonth
            ? new Date(viewYear, viewMonth, dayNum)
            : null;
          const dateKey = cellDate ? toDateKey(cellDate) : null;
          const dayTasks = dateKey ? (tasksByDate[dateKey] || []) : [];
          const isToday = dateKey === todayKey;
          const isPast = cellDate ? cellDate < new Date(today.getFullYear(), today.getMonth(), today.getDate()) : false;

          return (
            <div
              key={idx}
              className={cn(
                'min-h-[90px] border-b border-r border-slate-100 p-2 dark:border-slate-800',
                !isCurrentMonth && 'bg-slate-50/50 dark:bg-slate-800/20',
                isToday && 'bg-brand-50/40 dark:bg-brand-500/5',
                isPast && isCurrentMonth && !isToday && 'bg-white dark:bg-slate-900',
              )}
            >
              {isCurrentMonth && (
                <>
                  {/* Day number */}
                  <div className="mb-1 flex items-center justify-end">
                    <span
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                        isToday
                          ? 'bg-brand-500 text-white'
                          : isPast
                          ? 'text-slate-400'
                          : 'text-slate-700 dark:text-slate-300'
                      )}
                    >
                      {dayNum}
                    </span>
                  </div>

                  {/* Task pills */}
                  <div className="space-y-1">
                    {dayTasks.slice(0, 3).map((task) => {
                      const statusColor = TASK_STATUSES.find((s) => s.id === task.status)?.color ?? '#94a3b8';
                      const priorityColor = PRIORITY_CONFIG[task.priority]?.color ?? '#94a3b8';
                      return (
                        <button
                          key={task._id}
                          onClick={() => openTaskDetail(task._id)}
                          className="group flex w-full items-center gap-1.5 overflow-hidden rounded-md px-1.5 py-1 text-left transition-all hover:ring-1 hover:ring-brand-400/40"
                          style={{ backgroundColor: statusColor + '18' }}
                        >
                          <span
                            className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                            style={{ backgroundColor: priorityColor }}
                          />
                          <span
                            className="flex-1 truncate text-[11px] font-medium leading-tight"
                            style={{ color: statusColor }}
                          >
                            {task.title}
                          </span>
                        </button>
                      );
                    })}
                    {dayTasks.length > 3 && (
                      <p className="pl-1 text-[10px] font-medium text-slate-400">
                        +{dayTasks.length - 3} more
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
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
