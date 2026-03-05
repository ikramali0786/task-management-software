import { useEffect, useState, useMemo } from 'react';
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
} from 'lucide-react';
import { useTeamStore } from '@/store/teamStore';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { taskService } from '@/services/taskService';
import { Task, TaskStats, PRIORITY_CONFIG, TASK_STATUSES } from '@/types';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { formatRelative, cn } from '@/lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

/* ─── Motion variants ──────────────────────────────────────────────────── */
const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const cardVariant = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } },
};

/* ─── Constants ────────────────────────────────────────────────────────── */
const STATUS_COLORS: Record<string, string> = {
  todo: '#94a3b8',
  in_progress: '#6366f1',
  review: '#f59e0b',
  done: '#22c55e',
};

const STATUS_CHIP: Record<string, string> = {
  todo: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  in_progress: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400',
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

  useEffect(() => {
    if (!activeTeam) return;
    setStatsLoading(true);
    taskService
      .getStats(activeTeam._id)
      .then((s) => setStats(s))
      .finally(() => setStatsLoading(false));
  }, [activeTeam?._id]);

  useEffect(() => {
    if (!activeTeam || !user) return;
    setMyTasksLoading(true);
    taskService
      .getTasks({ teamId: activeTeam._id, assignee: user._id, limit: '30' })
      .then(({ tasks }) => setMyTasks(tasks.filter((t) => t.status !== 'done')))
      .finally(() => setMyTasksLoading(false));
  }, [activeTeam?._id, user?._id]);

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

  const statCards = [
    {
      label: 'Total Tasks',
      value: totalTasks,
      icon: CheckSquare,
      color: 'text-brand-500',
      bg: 'bg-brand-50 dark:bg-brand-500/10',
      accentColor: '#6366f1',
      sub: `${activeTeam?.members.length ?? 0} members in team`,
    },
    {
      label: 'In Progress',
      value: stats?.byStatus.in_progress ?? 0,
      icon: TrendingUp,
      color: 'text-indigo-500',
      bg: 'bg-indigo-50 dark:bg-indigo-500/10',
      accentColor: '#6366f1',
      sub: `${stats?.byStatus.review ?? 0} in review`,
    },
    {
      label: 'Completed',
      value: stats?.byStatus.done ?? 0,
      icon: Clock,
      color: 'text-emerald-500',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
      accentColor: '#22c55e',
      sub: `${completedPct}% completion rate`,
    },
    {
      label: 'Overdue',
      value: stats?.overdue ?? 0,
      icon: AlertTriangle,
      color: 'text-red-500',
      bg: 'bg-red-50 dark:bg-red-500/10',
      accentColor: '#ef4444',
      sub: 'need immediate attention',
    },
  ];

  /* ── No team state ──────────────────────────────────────────────────── */
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

  const greeting =
    new Date().getHours() < 12
      ? 'morning'
      : new Date().getHours() < 18
      ? 'afternoon'
      : 'evening';

  /* ── Main render ────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6 p-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
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
        <Button onClick={() => navigate('/board')} className="gap-2">
          <ArrowRight className="h-4 w-4" />
          Open Board
        </Button>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        {statCards.map((card) => (
          <motion.div
            key={card.label}
            variants={cardVariant}
            className="card relative overflow-hidden pt-5"
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
            </div>
            <div className="mt-4">
              <p className="text-3xl font-bold text-slate-900 dark:text-white">
                {statsLoading ? (
                  <span className="animate-pulse text-lg text-slate-300 dark:text-slate-600">
                    ···
                  </span>
                ) : (
                  card.value
                )}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                {card.label}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">{card.sub}</p>
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
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">My Tasks</h3>
              <p className="mt-0.5 text-xs text-slate-400">
                {myTasks.length} open task{myTasks.length !== 1 ? 's' : ''} assigned to you
              </p>
            </div>
            <button
              onClick={() => navigate('/board')}
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
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
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
                    onClick={() => navigate('/board')}
                  >
                    {/* Status dot */}
                    <div
                      className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: statusInfo?.color ?? '#94a3b8' }}
                    />

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

        {/* Charts column – 2 / 5 */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Task Status donut */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card"
          >
            <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
              Task Status
            </h3>
            {pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={38}
                      outerRadius={58}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg-glass)',
                        border: 'none',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-1 space-y-1.5">
                  {TASK_STATUSES.map(({ id, label }) => {
                    const count = stats?.byStatus[id] ?? 0;
                    const pct = totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0;
                    return (
                      <div key={id} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: STATUS_COLORS[id] }}
                          />
                          <span className="text-slate-500 dark:text-slate-400">{label}</span>
                        </div>
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {count}{' '}
                          <span className="text-slate-400">({pct}%)</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex h-36 items-center justify-center text-sm text-slate-400">
                No tasks yet
              </div>
            )}
          </motion.div>

          {/* By Priority */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="card"
          >
            <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
              By Priority
            </h3>
            <div className="space-y-3">
              {(['urgent', 'high', 'medium', 'low'] as const).map((p) => {
                const config = PRIORITY_CONFIG[p];
                const count = stats?.byPriority[p] ?? 0;
                const pct = totalTasks > 0 ? (count / totalTasks) * 100 : 0;
                return (
                  <div key={p}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-600 dark:text-slate-400">
                        {config.label}
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {count}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.6, type: 'spring', stiffness: 200 }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: config.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
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
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
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
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Team Members
            </h3>
            <button
              onClick={() => navigate('/team')}
              className="flex items-center gap-1 text-xs font-medium text-brand-500 transition-colors hover:text-brand-600"
            >
              Manage <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-3">
            {activeTeam.members.slice(0, 7).map((m) => (
              <div key={m.user._id} className="flex items-center gap-3">
                <div className="relative">
                  <Avatar name={m.user.name} src={m.user.avatar} size="sm" />
                  <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400 dark:border-slate-900" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                    {m.user.name}
                  </p>
                  <p className="text-xs capitalize text-slate-400">{m.role}</p>
                </div>
              </div>
            ))}
            {activeTeam.members.length > 7 && (
              <button
                onClick={() => navigate('/team')}
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
