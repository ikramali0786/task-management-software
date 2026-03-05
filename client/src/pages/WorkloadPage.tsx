import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart2,
  Users,
  Target,
  CheckCircle2,
  TrendingUp,
  ArrowUpDown,
  RefreshCw,
  Flame,
  Zap,
  Feather,
} from 'lucide-react';
import { useTeamStore } from '@/store/teamStore';
import { taskService } from '@/services/taskService';
import { WorkloadEntry, ProjectProgress, TASK_STATUSES } from '@/types';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

// ── Status colours ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  todo: '#94a3b8',
  in_progress: '#6366f1',
  review: '#f59e0b',
  done: '#22c55e',
};

const STATUS_BG: Record<string, string> = {
  todo: 'bg-slate-400',
  in_progress: 'bg-indigo-500',
  review: 'bg-amber-500',
  done: 'bg-emerald-500',
};

// ── Load-level ────────────────────────────────────────────────────────────────

type LoadLevel = 'heavy' | 'moderate' | 'light';

const getLoadLevel = (total: number): LoadLevel => {
  if (total > 10) return 'heavy';
  if (total >= 5) return 'moderate';
  return 'light';
};

const LOAD_CONFIG: Record<
  LoadLevel,
  {
    label: string;
    Icon: React.ElementType;
    borderClass: string;
    badgeClass: string;
    iconClass: string;
  }
> = {
  heavy: {
    label: 'Heavy load',
    Icon: Flame,
    borderClass: 'border-l-red-400',
    badgeClass: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
    iconClass: 'text-red-500',
  },
  moderate: {
    label: 'Moderate',
    Icon: Zap,
    borderClass: 'border-l-amber-400',
    badgeClass: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
    iconClass: 'text-amber-500',
  },
  light: {
    label: 'Light load',
    Icon: Feather,
    borderClass: 'border-l-emerald-400',
    badgeClass: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
    iconClass: 'text-emerald-500',
  },
};

// ── Sort options ──────────────────────────────────────────────────────────────

type SortKey = 'total' | 'name' | 'today';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'total', label: 'Most Tasks' },
  { key: 'name', label: 'A → Z' },
  { key: 'today', label: 'Completed Today' },
];

// ── Animation variants ────────────────────────────────────────────────────────

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const cardVariant = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } },
};

// ── Stat card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  colorClass: string;
  sub?: string;
  delay?: number;
}

const StatCard = ({ label, value, icon, colorClass, sub, delay = 0 }: StatCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay }}
    className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
  >
    <div
      className={cn(
        'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl',
        colorClass
      )}
    >
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className="mt-0.5 text-2xl font-bold leading-none text-slate-900 dark:text-white">
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  </motion.div>
);

// ── Page ──────────────────────────────────────────────────────────────────────

export const WorkloadPage = () => {
  const { activeTeam } = useTeamStore();
  const [workload, setWorkload] = useState<WorkloadEntry[]>([]);
  const [projectProgress, setProjectProgress] = useState<ProjectProgress>({
    total: 0,
    done: 0,
  });
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>('total');
  const [sortOpen, setSortOpen] = useState(false);

  const load = () => {
    if (!activeTeam) return;
    setLoading(true);
    taskService
      .getWorkload(activeTeam._id)
      .then(({ workload: w, projectProgress: pp }) => {
        setWorkload(w);
        setProjectProgress(pp);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTeam?._id]);

  // ── Derived totals ─────────────────────────────────────────────────────────

  const progressPct =
    projectProgress.total > 0
      ? Math.round((projectProgress.done / projectProgress.total) * 100)
      : 0;

  const totalCompletedToday = workload.reduce((s, e) => s + e.completedToday, 0);

  const inProgressCount = workload.reduce((s, e) => {
    const b = e.statusBreakdown.find((b) => b.status === 'in_progress');
    return s + (b?.count || 0);
  }, 0);

  // ── Sort ───────────────────────────────────────────────────────────────────

  const sortedWorkload = useMemo(() => {
    const w = [...workload];
    if (sortBy === 'name') return w.sort((a, b) => a.user.name.localeCompare(b.user.name));
    if (sortBy === 'today') return w.sort((a, b) => b.completedToday - a.completedToday);
    return w; // 'total' — already desc from server
  }, [workload, sortBy]);

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold text-slate-900 dark:text-white">
            <BarChart2 className="h-6 w-6 text-brand-500" />
            Team Workload
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {activeTeam
              ? `Task distribution for ${activeTeam.name}`
              : 'Task distribution across your team members.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Sort dropdown */}
          {!loading && workload.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setSortOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                {SORT_OPTIONS.find((o) => o.key === sortBy)?.label}
              </button>

              <AnimatePresence>
                {sortOpen && (
                  <>
                    {/* click-away layer */}
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setSortOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -4 }}
                      transition={{ duration: 0.12 }}
                      className="absolute right-0 top-full z-20 mt-1.5 w-44 rounded-xl border border-slate-100 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800"
                    >
                      {SORT_OPTIONS.map((opt) => (
                        <button
                          key={opt.key}
                          onClick={() => {
                            setSortBy(opt.key);
                            setSortOpen(false);
                          }}
                          className={cn(
                            'flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors',
                            sortBy === opt.key
                              ? 'bg-brand-50 font-medium text-brand-600 dark:bg-brand-500/10 dark:text-brand-400'
                              : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700'
                          )}
                        >
                          {sortBy === opt.key ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-brand-500" />
                          ) : (
                            <span className="h-3.5 w-3.5" />
                          )}
                          {opt.label}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Refresh */}
          <button
            onClick={load}
            disabled={loading}
            title="Refresh workload"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:text-slate-300"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────── */}
      {!loading && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Total Tasks"
            value={projectProgress.total}
            icon={<Target className="h-5 w-5 text-brand-500" />}
            colorClass="bg-brand-50 dark:bg-brand-500/10"
            delay={0}
          />
          <StatCard
            label="Completed"
            value={projectProgress.done}
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
            colorClass="bg-emerald-50 dark:bg-emerald-500/10"
            sub={`${progressPct}% of all tasks`}
            delay={0.05}
          />
          <StatCard
            label="In Progress"
            value={inProgressCount}
            icon={<TrendingUp className="h-5 w-5 text-indigo-500" />}
            colorClass="bg-indigo-50 dark:bg-indigo-500/10"
            delay={0.1}
          />
          <StatCard
            label="Done Today"
            value={totalCompletedToday}
            icon={<Zap className="h-5 w-5 text-amber-500" />}
            colorClass="bg-amber-50 dark:bg-amber-500/10"
            sub="across all members"
            delay={0.15}
          />
        </div>
      )}

      {/* ── Project progress bar ─────────────────────────────────────── */}
      {!loading && projectProgress.total > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-brand-500" />
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Project Progress
              </span>
            </div>
            <span className="text-2xl font-bold text-brand-600 dark:text-brand-400">
              {progressPct}%
            </span>
          </div>

          <div className="relative h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand-500 to-brand-400"
            />
          </div>

          {/* Status legend */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-3">
              {TASK_STATUSES.map(({ id, label }) => (
                <span key={id} className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: STATUS_COLORS[id] }}
                  />
                  {label}
                </span>
              ))}
            </div>
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {projectProgress.done} of {projectProgress.total} done
            </span>
          </div>
        </motion.div>
      )}

      {/* ── Body ────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </div>
      ) : sortedWorkload.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
            <Users className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">
            No assigned tasks yet
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            Assign tasks to team members to see workload distribution here.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Contributors ({sortedWorkload.length})
          </p>

          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-3"
          >
            {sortedWorkload.map((entry) => {
              const member = activeTeam?.members.find(
                (m) => m.user._id === entry.user._id
              );
              const role = member?.role || '';
              const hasBreakdown = entry.statusBreakdown.length > 0;
              const loadLevel = getLoadLevel(entry.total);
              const loadCfg = LOAD_CONFIG[loadLevel];
              const LoadIcon = loadCfg.Icon;

              return (
                <motion.div
                  key={entry.user._id}
                  variants={cardVariant}
                  className={cn(
                    'rounded-2xl border border-slate-100 border-l-4 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900',
                    loadCfg.borderClass
                  )}
                >
                  {/* Member info row */}
                  <div className="mb-4 flex items-center gap-4">
                    <Avatar name={entry.user.name} src={entry.user.avatar} size="md" />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {entry.user.name}
                        </p>
                        {role && (
                          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium capitalize text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                            {role}
                          </span>
                        )}
                        {/* Load level indicator */}
                        <span
                          className={cn(
                            'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                            loadCfg.badgeClass
                          )}
                        >
                          <LoadIcon className={cn('h-3 w-3', loadCfg.iconClass)} />
                          {loadCfg.label}
                        </span>
                      </div>

                      <div className="mt-0.5 flex flex-wrap items-center gap-3">
                        <p className="text-sm text-slate-500">
                          {entry.total} task{entry.total !== 1 ? 's' : ''} assigned
                        </p>
                        {entry.completedToday > 0 && (
                          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            {entry.completedToday} done today
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Total task count badge */}
                    <div className="flex h-12 w-12 flex-shrink-0 flex-col items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/10">
                      <span className="text-lg font-bold leading-none text-brand-600 dark:text-brand-400">
                        {entry.total}
                      </span>
                      <span className="mt-0.5 text-[10px] font-medium text-brand-400 dark:text-brand-500">
                        tasks
                      </span>
                    </div>
                  </div>

                  {/* Status bars */}
                  {hasBreakdown && (
                    <div className="space-y-2">
                      {TASK_STATUSES.map(({ id, label }) => {
                        const breakdown = entry.statusBreakdown.find(
                          (s) => s.status === id
                        );
                        const count = breakdown?.count || 0;
                        if (count === 0) return null;
                        const pct = entry.total > 0 ? (count / entry.total) * 100 : 0;

                        return (
                          <div key={id} className="flex items-center gap-3">
                            <div className="flex w-24 flex-shrink-0 items-center gap-1.5">
                              <span
                                className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                                style={{ backgroundColor: STATUS_COLORS[id] }}
                              />
                              <span className="truncate text-xs text-slate-500">{label}</span>
                            </div>

                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{
                                  duration: 0.7,
                                  ease: 'easeOut',
                                  delay: 0.15,
                                }}
                                className="h-full rounded-full"
                                style={{ backgroundColor: STATUS_COLORS[id] }}
                              />
                            </div>

                            {/* Count chip */}
                            <span
                              className={cn(
                                'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-[10px] font-bold text-white',
                                STATUS_BG[id]
                              )}
                            >
                              {count}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        </>
      )}
    </div>
  );
};
