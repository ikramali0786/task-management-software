import { useEffect, useState, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CheckSquare,
  Clock,
  AlertTriangle,
  TrendingUp,
  Plus,
  ArrowRight,
  SquareKanban,
  UserPlus,
  ChevronRight,
  CalendarClock,
  Inbox,
  Timer,
  Check,
} from 'lucide-react';
import { useTeamStore } from '@/store/teamStore';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { getSocket } from '@/lib/socket';
import { taskService } from '@/services/taskService';
import { Task, TaskStats, PRIORITY_CONFIG, TASK_STATUSES } from '@/types';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { CountUp } from '@/components/ui/CountUp';
import { formatRelative, formatLastSeen, cn } from '@/lib/utils';
// Recharts is heavy — defer it so cards & tasks paint first.
const DashboardCharts = lazy(() => import('@/components/dashboard/DashboardCharts'));

/* ─── Motion variants ──────────────────────────────────────────────────── */
const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const cardVariant = {
  hidden: { opacity: 0, y: 22, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 320, damping: 26 } },
};

/* ─── Constants ────────────────────────────────────────────────────────── */
// Mirrors TASK_STATUSES in types/index.ts so chart colors stay in sync with the palette.
const STATUS_COLORS: Record<string, string> = {
  todo: '#a89f8f',
  in_progress: '#0d9488',
  review: '#d97706',
  done: '#16a34a',
};

// Tiny dependency-free trend line for stat cards.
const Sparkline = ({ values, color = '#22c55e' }: { values: number[]; color?: string }) => {
  const w = 100, h = 22, max = Math.max(1, ...values);
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * (h - 2) - 1).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-5 w-full" preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

const STATUS_CHIP: Record<string, string> = {
  todo: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  in_progress: 'bg-brand-50 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400',
  review: 'bg-amber-50 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
  done: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
};

/* ─── Helpers ───────────────────────────────────────────────────────────── */
const isOverdue = (task: Task) =>
  !!task.dueDate && task.status !== 'done' && new Date(task.dueDate) < new Date();

const isDueSoon = (task: Task) => {
  if (!task.dueDate || task.status === 'done') return false;
  const diff = (new Date(task.dueDate).getTime() - Date.now()) / 86_400_000;
  return diff >= 0 && diff <= 2;
};

/* ─── Component ─────────────────────────────────────────────────────────── */
export const DashboardPage = () => {
  const { user } = useAuthStore();
  const { activeTeam } = useTeamStore();
  const { notifications, taskActivities } = useNotificationStore();
  const navigate = useNavigate();

  const [stats, setStats] = useState<TaskStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [myTasksLoading, setMyTasksLoading] = useState(false);
  const [myTasksTab, setMyTasksTab] = useState<'all' | 'due_soon' | 'overdue'>('all');
  const [metrics, setMetrics] = useState<Awaited<ReturnType<typeof taskService.getDashboardMetrics>> | null>(null);
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const [focus, setFocus] = useState<Awaited<ReturnType<typeof taskService.getSchedulingSuggestions>>>([]);
  const [error, setError] = useState(false);

  // Monotonic tokens so a stale response from a previous team can't overwrite the current one.
  const reqRef = useRef(0);
  const load = useCallback(async () => {
    if (!activeTeam || !user) return;
    const token = ++reqRef.current;
    const teamId = activeTeam._id;
    setError(false); setStatsLoading(true); setMyTasksLoading(true);
    const results = await Promise.allSettled([
      taskService.getStats(teamId),
      taskService.getTasks({ teamId, assignee: user._id, limit: '30' }),
    ]);
    if (token !== reqRef.current) return; // a newer load started — discard
    const [s, mt] = results;
    if (s.status === 'fulfilled') setStats(s.value); else setError(true);
    if (mt.status === 'fulfilled') setMyTasks(mt.value.tasks.filter((t) => t.status !== 'done')); else setError(true);
    setStatsLoading(false); setMyTasksLoading(false);
  }, [activeTeam?._id, user?._id]);

  const metricsReqRef = useRef(0);
  const loadMetrics = useCallback(async () => {
    if (!activeTeam) return;
    const token = ++metricsReqRef.current; const teamId = activeTeam._id;
    const tz = user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    try { const m = await taskService.getDashboardMetrics(teamId, range, tz); if (token === metricsReqRef.current) setMetrics(m); }
    catch { if (token === metricsReqRef.current) setMetrics(null); }
  }, [activeTeam?._id, range, user?.timezone]);

  const loadFocus = useCallback(async () => {
    if (!activeTeam) return;
    try { setFocus((await taskService.getSchedulingSuggestions(activeTeam._id)).slice(0, 4)); } catch { setFocus([]); }
  }, [activeTeam?._id]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadMetrics(); }, [loadMetrics]);
  useEffect(() => { void loadFocus(); }, [loadFocus]);

  // Live refresh: when any task changes anywhere, debounce-refresh everything.
  useEffect(() => {
    const socket = getSocket(); if (!socket || !activeTeam) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const bump = () => { if (t) clearTimeout(t); t = setTimeout(() => { void load(); void loadMetrics(); void loadFocus(); }, 800); };
    const events = ['task:created', 'task:updated', 'task:deleted', 'task:moved'];
    events.forEach((e) => socket.on(e, bump));
    return () => { if (t) clearTimeout(t); events.forEach((e) => socket.off(e, bump)); };
  }, [activeTeam?._id, load, loadMetrics, loadFocus]);

  // Inline actions
  const markDone = async (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    setMyTasks((ts) => ts.filter((t) => t._id !== task._id));
    try { await taskService.updateStatus(task._id, 'done'); void loadMetrics(); } catch { void load(); }
  };
  const scheduleTask = async (taskId: string, date: string) => {
    setFocus((f) => f.filter((x) => x.taskId !== taskId));
    try { await taskService.updateTask(taskId, { dueDate: date } as Partial<Task>); void load(); } catch { void loadFocus(); }
  };

  /* derived */
  const totalTasks = stats ? Object.values(stats.byStatus).reduce((a, b) => a + b, 0) : 0;
  const completedPct =
    totalTasks > 0 ? Math.round(((stats?.byStatus.done ?? 0) / totalTasks) * 100) : 0;

  const pieData = TASK_STATUSES.map(({ id, label }) => ({
    name: label,
    value: stats?.byStatus[id] ?? 0,
    color: STATUS_COLORS[id],
  })).filter((d) => d.value > 0);

  const overdueCount = useMemo(() => myTasks.filter(isOverdue).length, [myTasks]);
  const dueSoonCount = useMemo(() => myTasks.filter(isDueSoon).length, [myTasks]);

  const filteredMyTasks = useMemo(() => {
    if (myTasksTab === 'overdue') return myTasks.filter(isOverdue);
    if (myTasksTab === 'due_soon') return myTasks.filter(isDueSoon);
    return myTasks;
  }, [myTasks, myTasksTab]);

  // Server-computed metrics (cycle time, 30-day completion trend, throughput delta).
  const avgCycleTime = metrics?.avgCycleDays ?? null;
  const completionTrend = useMemo(() => (metrics?.trend ?? []).map((p) => ({ date: p.date.slice(5), count: p.count })), [metrics]);
  const completedDelta = metrics ? metrics.throughput - metrics.prevThroughput : 0;
  // Positive = cycle time dropped (team got faster) → shown green.
  const cycleDelta = metrics && metrics.avgCycleDays != null && metrics.prevAvgCycleDays != null
    ? Math.round((metrics.prevAvgCycleDays - metrics.avgCycleDays) * 10) / 10 : 0;

  const activityFeed = useMemo(() => {
    const notifItems = notifications.map((n) => ({
      id: n._id,
      message: n.message,
      createdAt: n.createdAt,
      kind: 'notification' as const,
      actorName: n.actor?.name,
      actorAvatar: n.actor?.avatar,
      icon: n.type === 'member_joined' ? 'member' : 'notification',
    }));
    const taskItems = taskActivities.map((a) => ({
      id: a._id,
      message: a.message,
      createdAt: a.createdAt,
      kind: 'task' as const,
      actorName: undefined as string | undefined,
      actorAvatar: undefined as string | null | undefined,
      icon: a.icon || 'task',
    }));
    return [...notifItems, ...taskItems]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);
  }, [notifications, taskActivities]);

  const cycleTimeColor =
    avgCycleTime === null
      ? 'text-slate-400'
      : avgCycleTime < 5
      ? 'text-emerald-500'
      : avgCycleTime <= 10
      ? 'text-amber-500'
      : 'text-red-500';
  const cycleTimeBg =
    avgCycleTime === null
      ? 'bg-slate-50 dark:bg-slate-800/50'
      : avgCycleTime < 5
      ? 'bg-emerald-50 dark:bg-emerald-500/10'
      : avgCycleTime <= 10
      ? 'bg-amber-50 dark:bg-amber-500/10'
      : 'bg-red-50 dark:bg-red-500/10';
  const cycleTimeAccent =
    avgCycleTime === null ? '#94a3b8' : avgCycleTime < 5 ? '#22c55e' : avgCycleTime <= 10 ? '#f59e0b' : '#ef4444';

  const statCards = [
    {
      label: 'Total Tasks',
      value: totalTasks,
      icon: CheckSquare,
      color: 'text-brand-500',
      bg: 'bg-brand-50 dark:bg-brand-500/10',
      accentColor: '#e8502e',
      sub: `${activeTeam?.members.length ?? 0} members in team`,
      href: '/app/board',
      delta: 0,
      deltaSuffix: '',
      sparkline: (metrics?.created ?? []).map((c) => c.count),
    },
    {
      label: 'In Progress',
      value: stats?.byStatus.in_progress ?? 0,
      icon: TrendingUp,
      color: 'text-brand-500',
      bg: 'bg-brand-50 dark:bg-brand-500/10',
      accentColor: '#e8502e',
      sub: `${stats?.byStatus.review ?? 0} in review`,
      href: '/app/board?status=in_progress&view=list',
      delta: 0,
      deltaSuffix: '',
      sparkline: [] as number[],
    },
    {
      label: 'Completed',
      value: stats?.byStatus.done ?? 0,
      icon: Clock,
      color: 'text-emerald-500',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
      accentColor: '#22c55e',
      sub: `${completedPct}% completion rate`,
      href: '/app/board?status=done&view=list',
      delta: completedDelta,
      deltaSuffix: '',
      sparkline: (metrics?.trend ?? []).map((t) => t.count),
    },
    {
      label: 'Overdue',
      value: stats?.overdue ?? 0,
      icon: AlertTriangle,
      color: 'text-red-500',
      bg: 'bg-red-50 dark:bg-red-500/10',
      accentColor: '#ef4444',
      sub: 'need immediate attention',
      href: '/app/board?due=overdue',
      delta: 0,
      deltaSuffix: '',
      sparkline: [] as number[],
    },
    {
      label: 'Avg Cycle Time',
      value: avgCycleTime !== null ? `${avgCycleTime}d` : '—',
      icon: Timer,
      color: cycleTimeColor,
      bg: cycleTimeBg,
      accentColor: cycleTimeAccent,
      sub: `last ${range} days`,
      href: '/app/workload',
      delta: cycleDelta,
      deltaSuffix: 'd',
      sparkline: [] as number[],
    },
  ];

  /* ── No team state ──────────────────────────────────────────────────── */
  if (!activeTeam) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
        <div className="rounded-2xl bg-brand-50 p-6 dark:bg-brand-500/10">
          <Plus className="h-10 w-10 text-brand-500" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">No team yet</h2>
        <p className="max-w-sm text-center text-sm text-slate-500">
          Create a team or join one with an invite code to get started.
        </p>
      </div>
    );
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';

  /* ── Main render ────────────────────────────────────────────────────── */
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-6 md:p-8">
      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
          <span>Some dashboard data couldn’t load.</span>
          <button onClick={() => void load()} className="font-medium underline-offset-2 hover:underline">Retry</button>
        </div>
      )}
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Good {greeting},{' '}
            <span className="gradient-text">{user?.name?.split(' ')[0]}</span>
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {activeTeam.name} ·{' '}
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <Button onClick={() => navigate('/app/board')} className="gap-2">
          <ArrowRight className="h-4 w-4" />
          Open Board
        </Button>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 gap-4 lg:grid-cols-5"
      >
        {statCards.map((card) => (
          <motion.div
            key={card.label}
            variants={cardVariant}
            whileHover={{ y: -4 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            role="button"
            tabIndex={0}
            onClick={() => navigate(card.href)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(card.href); } }}
            aria-label={`${card.label}: ${card.value}. ${card.sub}`}
            className="card relative cursor-pointer overflow-hidden pt-5 transition-shadow hover:shadow-lift focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            {/* Colored accent strip */}
            <div
              className="absolute inset-x-0 top-0 h-1 rounded-t-2xl"
              style={{ backgroundColor: card.accentColor }}
            />

            <div className="flex items-center justify-between">
              <div className={cn('rounded-xl p-2.5', card.bg)}>
                <card.icon className={cn('h-5 w-5', card.color)} />
              </div>
              {card.delta !== 0 && (
                <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-semibold', card.delta > 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-red-50 text-red-500 dark:bg-red-500/10')} title={`vs previous ${range} days`}>
                  {card.delta > 0 ? '+' : ''}{card.delta}{card.deltaSuffix} vs prev
                </span>
              )}
            </div>
            <div className="mt-4">
              <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                {statsLoading ? (
                  <span className="animate-pulse text-lg text-slate-300 dark:text-slate-600">
                    ···
                  </span>
                ) : typeof card.value === 'number' ? (
                  <CountUp value={card.value} />
                ) : (
                  card.value
                )}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                {card.label}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">{card.sub}</p>
              {card.sparkline.length > 1 && <Sparkline values={card.sparkline} color={card.accentColor} />}
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Main content: My Tasks + Charts ─────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* My Tasks – 3 / 5 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="card lg:col-span-3"
        >
          {/* Widget header */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">My Tasks</h3>
              <p className="mt-0.5 text-xs text-slate-400">
                {myTasks.length} open task{myTasks.length !== 1 ? 's' : ''} assigned to you
              </p>
            </div>
            <button
              onClick={() => navigate('/app/board')}
              className="flex items-center gap-1 text-xs font-medium text-brand-500 hover:text-brand-600 transition-colors"
            >
              View all <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Filter tabs */}
          <div className="mb-4 flex w-fit gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {(
              [
                { key: 'all' as const, label: `All (${myTasks.length})` },
                { key: 'due_soon' as const, label: `Due Soon${dueSoonCount > 0 ? ` (${dueSoonCount})` : ''}` },
                { key: 'overdue' as const, label: `Overdue${overdueCount > 0 ? ` (${overdueCount})` : ''}` },
              ]
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setMyTasksTab(tab.key)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                  myTasksTab === tab.key
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Task list */}
          {myTasksLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"
                />
              ))}
            </div>
          ) : filteredMyTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 rounded-2xl bg-slate-100 p-4 dark:bg-slate-800">
                <Inbox className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {myTasksTab === 'overdue'
                  ? 'No overdue tasks — great job! 🎉'
                  : myTasksTab === 'due_soon'
                  ? 'Nothing due in the next 2 days'
                  : 'No open tasks assigned to you'}
              </p>
              {myTasksTab === 'all' && (
                <p className="mt-1 text-xs text-slate-400">
                  Ask a teammate to assign you some tasks!
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredMyTasks.map((task) => {
                const overdue = isOverdue(task);
                const soon = !overdue && isDueSoon(task);
                const prioConfig = PRIORITY_CONFIG[task.priority];
                const statusInfo = TASK_STATUSES.find((s) => s.id === task.status);
                return (
                  <div
                    key={task._id}
                    className="group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    onClick={() => navigate('/app/board')}
                  >
                    {/* Mark complete (hover) */}
                    <button
                      onClick={(e) => markDone(e, task)}
                      title="Mark complete"
                      aria-label={`Mark "${task.title}" complete`}
                      className="group/done flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors hover:border-emerald-500 hover:bg-emerald-500"
                      style={{ borderColor: statusInfo?.color ?? '#94a3b8' }}
                    >
                      <Check className="h-3 w-3 text-white opacity-0 transition-opacity group-hover/done:opacity-100" />
                    </button>

                    {/* Title + meta */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800 transition-colors group-hover:text-brand-600 dark:text-slate-100 dark:group-hover:text-brand-400">
                        {task.title}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium',
                            STATUS_CHIP[task.status]
                          )}
                        >
                          {statusInfo?.label}
                        </span>
                        {task.dueDate && (
                          <span
                            className={cn(
                              'flex items-center gap-1 text-[10px]',
                              overdue
                                ? 'font-semibold text-red-500'
                                : soon
                                ? 'font-medium text-amber-500'
                                : 'text-slate-400'
                            )}
                          >
                            <CalendarClock className="h-3 w-3" />
                            {overdue ? 'Overdue · ' : ''}
                            {new Date(task.dueDate).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Priority chip */}
                    <span
                      className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{
                        backgroundColor: prioConfig.color + '22',
                        color: prioConfig.color,
                      }}
                    >
                      {prioConfig.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Right column – 2 / 5: Focus + (lazy) charts */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {focus.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }} className="card">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Suggested next</h3>
                <span className="text-xs text-slate-400">needs a due date</span>
              </div>
              <div className="space-y-2">
                {focus.map((s) => (
                  <div key={s.taskId} className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PRIORITY_CONFIG[s.priority as keyof typeof PRIORITY_CONFIG]?.color ?? '#94a3b8' }} />
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-300">{s.title}</span>
                    <button onClick={() => scheduleTask(s.taskId, s.suggestedDate)} className="shrink-0 rounded-md bg-brand-50 px-2 py-1 text-[11px] font-medium text-brand-600 transition-colors hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-400 dark:hover:bg-brand-500/20">
                      Schedule {new Date(s.suggestedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
          <Suspense fallback={<div className="card h-64 animate-pulse" />}>
            <DashboardCharts
              trend={completionTrend}
              range={range}
              onRangeChange={setRange}
              pieData={pieData}
              statusCounts={stats?.byStatus ?? {}}
              priorityCounts={stats?.byPriority ?? {}}
              totalTasks={totalTasks}
            />
          </Suspense>
        </div>
      </div>

      {/* ── Bottom row: Activity + Team Members ─────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Activity – 2 / 3 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="card lg:col-span-2"
        >
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Recent Activity
          </h3>
          {activityFeed.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No recent activity</p>
          ) : (
            <div className="space-y-3">
              {activityFeed.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3">
                  {entry.kind === 'notification' && entry.actorName ? (
                    <Avatar name={entry.actorName} src={entry.actorAvatar ?? null} size="xs" />
                  ) : (
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-500/10">
                      {entry.icon === 'member' ? (
                        <UserPlus className="h-3 w-3 text-brand-500" />
                      ) : (
                        <SquareKanban className="h-3 w-3 text-brand-500" />
                      )}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-700 dark:text-slate-300">{entry.message}</p>
                    <p className="text-xs text-slate-400">{formatRelative(entry.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Team Members – 1 / 3 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Team Members
            </h3>
            <button
              onClick={() => navigate('/app/team')}
              className="flex items-center gap-1 text-xs font-medium text-brand-500 transition-colors hover:text-brand-600"
            >
              Manage <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-3">
            {activeTeam.members.slice(0, 7).map((m) => {
              const { label: activeLabel, isActive } = formatLastSeen(m.user.lastSeenAt);
              return (
                <div key={m.user._id} className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar name={m.user.name} src={m.user.avatar} size="sm" />
                    <div
                      className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-slate-900 ${
                        isActive ? 'bg-emerald-400' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                      {m.user.name}
                    </p>
                    <p className="text-xs text-slate-400">{activeLabel}</p>
                  </div>
                </div>
              );
            })}
            {activeTeam.members.length > 7 && (
              <button
                onClick={() => navigate('/app/team')}
                className="w-full rounded-xl py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                +{activeTeam.members.length - 7} more members
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};
