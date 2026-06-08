import { useEffect, useMemo } from 'react';
import { GanttChartSquare, CalendarOff } from 'lucide-react';
import { useTaskStore } from '@/store/taskStore';
import { useTeamStore } from '@/store/teamStore';
import { useUIStore } from '@/store/uiStore';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { EmptyState } from '@/components/ui/EmptyState';
import { Task, TASK_STATUSES } from '@/types';
import { cn } from '@/lib/utils';

const DAY = 86_400_000;
const DAY_W = 34;       // px per day
const LABEL_W = 240;    // sticky left column width
const ROW_H = 40;
const MAX_DAYS = 240;   // safety cap on horizontal width

const STATUS_COLOR: Record<string, string> = Object.fromEntries(TASK_STATUSES.map((s) => [s.id, s.color]));
const startOfDay = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
const taskStart = (t: Task) => startOfDay(t.startDate ? new Date(t.startDate).getTime() : new Date(t.dueDate as string).getTime());
const taskEnd = (t: Task) => startOfDay(new Date(t.dueDate as string).getTime());

export const TimelinePage = () => {
  const { tasks, fetchTasks, isLoading, activeTeamId } = useTaskStore();
  const { activeTeam } = useTeamStore();
  const { openTaskDetail } = useUIStore();

  useEffect(() => {
    if (activeTeam && activeTeamId !== activeTeam._id) fetchTasks(activeTeam._id);
  }, [activeTeam?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const scheduled = useMemo(
    () => Object.values(tasks)
      .filter((t) => !t.isArchived && t.dueDate)
      .sort((a, b) => taskStart(a) - taskStart(b)),
    [tasks]
  );

  const { rangeStart, totalDays, weekTicks, todayOffset } = useMemo(() => {
    const today = startOfDay(Date.now());
    if (scheduled.length === 0) return { rangeStart: today, totalDays: 1, weekTicks: [] as number[], todayOffset: 0 };
    let min = today, max = today;
    for (const t of scheduled) { min = Math.min(min, taskStart(t)); max = Math.max(max, taskEnd(t)); }
    const start = min - 2 * DAY;
    let days = Math.round((max - start) / DAY) + 4;
    days = Math.min(days, MAX_DAYS);
    const ticks: number[] = [];
    for (let i = 0; i < days; i += 7) ticks.push(i);
    return { rangeStart: start, totalDays: days, weekTicks: ticks, todayOffset: Math.round((today - start) / DAY) };
  }, [scheduled]);

  if (!activeTeam) {
    return <PageContainer width="full"><EmptyState icon={GanttChartSquare} title="No team selected" description="Select a team to view its timeline." /></PageContainer>;
  }

  const trackW = totalDays * DAY_W;
  const fmtTick = (offsetDays: number) =>
    new Date(rangeStart + offsetDays * DAY).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <PageContainer width="full">
      <PageHeader icon={GanttChartSquare} title="Timeline" description={`Gantt view of scheduled work in ${activeTeam.name}`} />

      {isLoading && scheduled.length === 0 ? (
        <div className="card h-64 animate-pulse" />
      ) : scheduled.length === 0 ? (
        <EmptyState
          icon={CalendarOff}
          title="Nothing scheduled yet"
          description="Tasks with a due date appear here. Set a start date on a task to give it a span."
        />
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <div style={{ width: LABEL_W + trackW }}>
              {/* Header */}
              <div className="flex h-9 items-stretch border-b border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/60">
                <div style={{ width: LABEL_W }} className="sticky left-0 z-10 flex items-center bg-slate-50/80 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400 backdrop-blur dark:bg-slate-900/80">
                  Task
                </div>
                <div className="relative" style={{ width: trackW }}>
                  {weekTicks.map((off) => (
                    <div key={off} className="absolute top-0 h-full border-l border-slate-200/70 pl-1 text-[10px] text-slate-400 dark:border-slate-800" style={{ left: off * DAY_W }}>
                      {fmtTick(off)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Rows */}
              <div className="relative">
                {/* Today line spanning all rows */}
                {todayOffset >= 0 && todayOffset <= totalDays && (
                  <div className="pointer-events-none absolute top-0 z-[5] w-px bg-brand-500/60" style={{ left: LABEL_W + todayOffset * DAY_W, height: scheduled.length * ROW_H }} />
                )}
                {scheduled.map((t) => {
                  const offset = Math.max(0, Math.round((taskStart(t) - rangeStart) / DAY));
                  const span = Math.max(1, Math.round((taskEnd(t) - taskStart(t)) / DAY) + 1);
                  const color = STATUS_COLOR[t.status] || '#94a3b8';
                  return (
                    <div key={t._id} className="flex items-center border-b border-slate-100 last:border-0 dark:border-slate-800/60" style={{ height: ROW_H }}>
                      <div style={{ width: LABEL_W }} className="sticky left-0 z-10 flex h-full items-center gap-2 bg-white px-4 dark:bg-slate-900">
                        {t.identifier != null && <span className="font-mono text-[10px] text-slate-400">#{t.identifier}</span>}
                        <span className="truncate text-sm text-slate-700 dark:text-slate-200">{t.title}</span>
                      </div>
                      <div className="relative h-full" style={{ width: trackW }}>
                        <button
                          onClick={() => openTaskDetail(t._id)}
                          title={t.title}
                          className="absolute top-1/2 flex h-6 -translate-y-1/2 items-center overflow-hidden rounded-md px-2 text-[11px] font-medium text-white shadow-sm transition-transform hover:-translate-y-1/2 hover:brightness-110"
                          style={{ left: offset * DAY_W, width: Math.max(span * DAY_W - 4, 18), background: color }}
                        >
                          <span className="truncate">{span > 2 ? t.title : ''}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      {scheduled.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
          {TASK_STATUSES.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded" style={{ background: s.color }} /> {s.label}</span>
          ))}
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-px bg-brand-500" /> Today</span>
        </div>
      )}
    </PageContainer>
  );
};
