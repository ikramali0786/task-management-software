import { useState, useEffect } from 'react';
import { UserPlus, Calendar } from 'lucide-react';
import { useTeamStore } from '@/store/teamStore';
import { useAuthStore } from '@/store/authStore';
import { taskService } from '@/services/taskService';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { TaskStats } from '@/types';

const STATUS_PILL_COLORS: Record<string, string> = {
  todo: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  in_progress: 'bg-brand-100 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
  review: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  done: 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-300',
};

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

  return (
    <div className="space-y-5">
      {/* Meta row */}
      <div className="card">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{activeTeam.members.length}</p>
            <p className="text-xs text-slate-400 mt-0.5">Members</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats ? (stats.byStatus['done'] || 0) : '—'}</p>
            <p className="text-xs text-slate-400 mt-0.5">Completed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-500">{stats?.overdue ?? '—'}</p>
            <p className="text-xs text-slate-400 mt-0.5">Overdue</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {stats ? Object.values(stats.byStatus).reduce((s, c) => s + c, 0) : '—'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Total Tasks</p>
          </div>
        </div>
      </div>

      {/* Member Avatars */}
      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Team Members</h3>
          {isAdmin && (
            <button onClick={onInvite} className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-600 font-medium">
              <UserPlus className="h-3.5 w-3.5" /> Invite
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          {activeTeam.members.slice(0, 12).map((m) => (
            <div key={m.user._id} className="flex flex-col items-center gap-1">
              <Avatar name={m.user.name} src={m.user.avatar} size="md" />
              <span className="text-xs text-slate-500 max-w-[48px] truncate text-center">{m.user.name.split(' ')[0]}</span>
            </div>
          ))}
          {activeTeam.members.length > 12 && (
            <div className="flex flex-col items-center gap-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500 dark:bg-slate-700">
                +{activeTeam.members.length - 12}
              </div>
              <span className="text-xs text-slate-400">more</span>
            </div>
          )}
        </div>
      </div>

      {/* Task status pills */}
      {stats && (
        <div className="card">
          <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Task Status</h3>
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'todo', label: 'To Do' },
              { key: 'in_progress', label: 'In Progress' },
              { key: 'review', label: 'In Review' },
              { key: 'done', label: 'Done' },
            ].map(({ key, label }) => (
              <span key={key} className={cn('rounded-full px-3 py-1 text-xs font-semibold', STATUS_PILL_COLORS[key])}>
                {label}: {stats.byStatus[key as keyof typeof stats.byStatus] || 0}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Created date */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Calendar className="h-3.5 w-3.5" />
        Team created {new Date(activeTeam.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
      </div>
    </div>
  );
};
