import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart2, Users, Target, CheckCircle2 } from 'lucide-react';
import { useTeamStore } from '@/store/teamStore';
import { taskService } from '@/services/taskService';
import { WorkloadEntry, ProjectProgress, TASK_STATUSES } from '@/types';
import { Avatar } from '@/components/ui/Avatar';

const STATUS_COLORS: Record<string, string> = {
  todo: '#94a3b8',
  in_progress: '#6366f1',
  review: '#f59e0b',
  done: '#22c55e',
};

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 28 } },
};

export const WorkloadPage = () => {
  const { activeTeam } = useTeamStore();
  const [workload, setWorkload] = useState<WorkloadEntry[]>([]);
  const [projectProgress, setProjectProgress] = useState<ProjectProgress>({ total: 0, done: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeTeam) return;
    setLoading(true);
    taskService
      .getWorkload(activeTeam._id)
      .then(({ workload: w, projectProgress: pp }) => {
        setWorkload(w);
        setProjectProgress(pp);
      })
      .finally(() => setLoading(false));
  }, [activeTeam?._id]);

  const progressPct = projectProgress.total > 0
    ? Math.round((projectProgress.done / projectProgress.total) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="flex items-center gap-2.5 text-2xl font-bold text-slate-900 dark:text-white">
          <BarChart2 className="h-6 w-6 text-brand-500" />
          Team Workload
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Task distribution across your team members.
        </p>
      </div>

      {/* Project Progress Bar */}
      {!loading && projectProgress.total > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-brand-500" />
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Project Progress
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-brand-600 dark:text-brand-400">
                {progressPct}%
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="relative h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }}
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand-500 to-brand-400"
            />
          </div>

          <div className="mt-2.5 flex items-center justify-between text-xs text-slate-400">
            <span>{projectProgress.done} of {projectProgress.total} tasks completed</span>
            <span className="flex items-center gap-1 font-medium text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {projectProgress.done} done
            </span>
          </div>
        </motion.div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </div>
      ) : workload.length === 0 ? (
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
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="space-y-4"
        >
          {workload.map((entry) => {
            const member = activeTeam?.members.find(
              (m) => m.user._id === entry.user._id
            );
            const role = member?.role || '';
            const hasBreakdown = entry.statusBreakdown.length > 0;

            return (
              <motion.div
                key={entry.user._id}
                variants={item}
                className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                {/* Member info */}
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
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-3">
                      <p className="text-sm text-slate-500">
                        {entry.total} task{entry.total !== 1 ? 's' : ''}
                      </p>
                      {entry.completedToday > 0 && (
                        <span className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                          <CheckCircle2 className="h-3 w-3" />
                          🎯 {entry.completedToday} completed today
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Total badge */}
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/10">
                    <span className="text-sm font-bold text-brand-600 dark:text-brand-400">
                      {entry.total}
                    </span>
                  </div>
                </div>

                {/* Status breakdown bars */}
                {hasBreakdown && (
                  <div className="space-y-2.5">
                    {TASK_STATUSES.map(({ id, label }) => {
                      const breakdown = entry.statusBreakdown.find(
                        (s) => s.status === id
                      );
                      const count = breakdown?.count || 0;
                      if (count === 0) return null;
                      const pct =
                        entry.total > 0 ? (count / entry.total) * 100 : 0;

                      return (
                        <div key={id} className="flex items-center gap-3">
                          <span className="w-20 flex-shrink-0 truncate text-xs text-slate-500">
                            {label}
                          </span>
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
                          <span className="w-6 flex-shrink-0 text-right text-xs font-semibold text-slate-600 dark:text-slate-400">
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
      )}
    </div>
  );
};
