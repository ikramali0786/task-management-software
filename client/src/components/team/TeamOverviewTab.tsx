import { useState, useEffect } from 'react';
import { UserPlus, Users, CheckCircle2, AlertTriangle, ListTodo } from 'lucide-react';
import { useTeamStore } from '@/store/teamStore';
import { useAuthStore } from '@/store/authStore';
import { taskService } from '@/services/taskService';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { TaskStats } from '@/types';

const STATUS_META: { key: keyof TaskStats['byStatus']; label: string; color: string }[] = [
  { key: 'todo', label: 'To do', color: '#a89f8f' },
  { key: 'in_progress', label: 'In progress', color: '#e8502e' },
  { key: 'review', label: 'In review', color: '#d97706' },
  { key: 'done', label: 'Done', color: '#16a34a' },
];

export const TeamOverviewTab = ({ onInvite }: { onInvite: () => void }) => {
  const { activeTeam } = useTeamStore();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<TaskStats | null>(null);

  useEffect(() => {
    if (!activeTeam) return;
    taskService.getStats(activeTeam._id).then(setStats).catch(() => {});
  }, [activeTeam?._id]);

  if (!activeTeam) return null;
  const isOwner = activeTeam.owner._id === user?._id;
  const currentMember = activeTeam.members.find((m) => m.user._id === user?._id);
  const isAdmin = isOwner || currentMember?.role === 'admin';

  const totalTasks = stats ? Object.values(stats.byStatus).reduce((s, c) => s + c, 0) : null;
  const fmt = (v: number | null | undefined) => (v === null || v === undefined ? '—' : v);

  const statCards = [
    {
      label: 'Members',
      value: activeTeam.members.length,
      icon: Users,
      color: 'text-brand-500',
      bg: 'bg-brand-50 dark:bg-brand-500/10',
    },
    {
      label: 'Completed',
      value: fmt(stats?.byStatus['done']),
      icon: CheckCircle2,
      color: 'text-emerald-500',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    },
    {
      label: 'Overdue',
      value: fmt(stats?.overdue),
      icon: AlertTriangle,
      color: 'text-red-500',
      bg: 'bg-red-50 dark:bg-red-500/10',
    },
    {
      label: 'Total tasks',
      value: fmt(totalTasks),
      icon: ListTodo,
      color: 'text-slate-500 dark:text-slate-400',
      bg: 'bg-slate-100 dark:bg-slate-800',
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className="card">
            <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', card.bg)}>
              <card.icon className={cn('h-5 w-5', card.color)} />
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-slate-100">{card.value}</p>
            <p className="mt-0.5 text-xs text-slate-400">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Task status breakdown */}
      {stats && (
        <div className="card">
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Task status</h3>
          {totalTasks && totalTasks > 0 ? (
            <>
              <div className="mb-4 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                {STATUS_META.map(({ key, color }) => {
                  const c = stats.byStatus[key] || 0;
                  const pct = (c / totalTasks) * 100;
                  return pct > 0 ? <div key={key} style={{ width: `${pct}%`, backgroundColor: color }} /> : null;
                })}
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-4">
                {STATUS_META.map(({ key, label, color }) => {
                  const c = stats.byStatus[key] || 0;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
                      <span className="min-w-0 flex-1 truncate text-xs text-slate-500 dark:text-slate-400">{label}</span>
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{c}</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="py-6 text-center text-sm text-slate-400">No tasks yet</p>
          )}
        </div>
      )}

      {/* Team roster */}
      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Team members</h3>
          {isAdmin && (
            <button
              onClick={onInvite}
              className="flex items-center gap-1 text-xs font-medium text-brand-500 transition-colors hover:text-brand-600"
            >
              <UserPlus className="h-3.5 w-3.5" /> Invite
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-4">
          {activeTeam.members.slice(0, 12).map((m) => (
            <div key={m.user._id} className="flex w-14 flex-col items-center gap-1.5">
              <Avatar name={m.user.name} src={m.user.avatar} size="md" />
              <span className="w-full truncate text-center text-xs text-slate-500 dark:text-slate-400">
                {m.user.name.split(' ')[0]}
              </span>
            </div>
          ))}
          {activeTeam.members.length > 12 && (
            <div className="flex w-14 flex-col items-center gap-1.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500 ring-2 ring-white dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-900">
                +{activeTeam.members.length - 12}
              </div>
              <span className="text-xs text-slate-400">more</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
