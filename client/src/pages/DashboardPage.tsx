import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckSquare, Clock, AlertTriangle, TrendingUp, Plus, ArrowRight } from 'lucide-react';
import { useTeamStore } from '@/store/teamStore';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { taskService } from '@/services/taskService';
import { TaskStats, PRIORITY_CONFIG, TASK_STATUSES } from '@/types';
import { Avatar, AvatarGroup } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { formatRelative, cn } from '@/lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } },
};

const STATUS_COLORS: Record<string, string> = {
  todo: '#94a3b8',
  in_progress: '#6366f1',
  review: '#f59e0b',
  done: '#22c55e',
};

export const DashboardPage = () => {
  const { user } = useAuthStore();
  const { activeTeam } = useTeamStore();
  const { notifications } = useNotificationStore();
  const navigate = useNavigate();

  const [stats, setStats] = useState<TaskStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    if (activeTeam) {
      setStatsLoading(true);
      taskService.getStats(activeTeam._id)
        .then((s) => setStats(s))
        .finally(() => setStatsLoading(false));
    }
  }, [activeTeam?._id]);

  const totalTasks = stats
    ? Object.values(stats.byStatus).reduce((a, b) => a + b, 0)
    : 0;

  const pieData = TASK_STATUSES.map(({ id, label }) => ({
    name: label,
    value: stats?.byStatus[id] || 0,
    color: STATUS_COLORS[id],
  })).filter((d) => d.value > 0);

  const statCards = [
    {
      label: 'Total Tasks',
      value: totalTasks,
      icon: CheckSquare,
      color: 'text-brand-500',
      bg: 'bg-brand-50 dark:bg-brand-500/10',
    },
    {
      label: 'In Progress',
      value: stats?.byStatus.in_progress || 0,
      icon: TrendingUp,
      color: 'text-blue-500',
      bg: 'bg-blue-50 dark:bg-blue-500/10',
    },
    {
      label: 'Completed',
      value: stats?.byStatus.done || 0,
      icon: Clock,
      color: 'text-emerald-500',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    },
    {
      label: 'Overdue',
      value: stats?.overdue || 0,
      icon: AlertTriangle,
      color: 'text-red-500',
      bg: 'bg-red-50 dark:bg-red-500/10',
    },
  ];

  if (!activeTeam) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
        <div className="rounded-2xl bg-brand-50 p-6 dark:bg-brand-500/10">
          <Plus className="h-10 w-10 text-brand-500" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">No team yet</h2>
        <p className="max-w-sm text-center text-sm text-slate-500">
          Create a team or join one with an invite code to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'},{' '}
            <span className="gradient-text">{user?.name?.split(' ')[0]}</span>
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {activeTeam.name} · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Button onClick={() => navigate('/board')} className="gap-2">
          <ArrowRight className="h-4 w-4" />
          Open Board
        </Button>
      </div>

      {/* Stats */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        {statCards.map((card) => (
          <motion.div key={card.label} variants={item} className="card">
            <div className="flex items-center justify-between">
              <div className={cn('rounded-xl p-2.5', card.bg)}>
                <card.icon className={cn('h-5 w-5', card.color)} />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-3xl font-bold text-slate-900 dark:text-white">
                {statsLoading ? <span className="text-lg animate-pulse">...</span> : card.value}
              </p>
              <p className="mt-1 text-sm text-slate-500">{card.label}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Priority breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card"
        >
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Task Status</h3>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-glass)', border: 'none', borderRadius: 8, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-2">
                {TASK_STATUSES.map(({ id, label }) => (
                  <div key={id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[id] }} />
                      <span className="text-slate-600 dark:text-slate-400">{label}</span>
                    </div>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {stats?.byStatus[id] || 0}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-slate-400">
              No tasks yet
            </div>
          )}
        </motion.div>

        {/* Priority breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="card"
        >
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">By Priority</h3>
          <div className="space-y-3">
            {(['urgent', 'high', 'medium', 'low'] as const).map((p) => {
              const config = PRIORITY_CONFIG[p];
              const count = stats?.byPriority[p] || 0;
              const pct = totalTasks > 0 ? (count / totalTasks) * 100 : 0;
              return (
                <div key={p}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-600 dark:text-slate-400">{config.label}</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">{count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: config.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Team Members */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Team Members</h3>
            <span className="text-xs text-slate-400">{activeTeam.members.length} total</span>
          </div>
          <div className="space-y-3">
            {activeTeam.members.slice(0, 6).map((m) => (
              <div key={m.user._id} className="flex items-center gap-3">
                <Avatar name={m.user.name} src={m.user.avatar} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{m.user.name}</p>
                  <p className="text-xs text-slate-400 capitalize">{m.role}</p>
                </div>
                <div className="h-2 w-2 rounded-full bg-emerald-400" title="Online" />
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="card"
      >
        <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Recent Activity</h3>
        {notifications.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No recent activity</p>
        ) : (
          <div className="space-y-3">
            {notifications.slice(0, 5).map((n) => (
              <div key={n._id} className="flex items-start gap-3">
                <Avatar name={n.actor.name} src={n.actor.avatar} size="xs" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-700 dark:text-slate-300">{n.message}</p>
                  <p className="text-xs text-slate-400">{formatRelative(n.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};
