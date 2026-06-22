import { useState } from 'react';
import {
  Bell, BellOff, Volume2, VolumeX, Mail, Zap, AlertCircle, CheckCircle2,
  MessageSquare, CalendarClock, Users,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { usePrefsStore } from '@/store/prefsStore';
import { authService } from '@/services/authService';
import { cn } from '@/lib/utils';

/* ─── Toggle Switch ─────────────────────────────────────── */
const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={cn(
      'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900',
      checked ? 'bg-brand-500 shadow-ember' : 'bg-slate-200 dark:bg-slate-700'
    )}
    aria-checked={checked}
    role="switch"
  >
    <span
      className={cn(
        'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md ring-0 transition-transform duration-200',
        checked ? 'translate-x-5' : 'translate-x-0'
      )}
    />
  </button>
);

/* ─── Notification Row ──────────────────────────────────── */
const NotifRow = ({
  icon: Icon, iconBg, title, desc, checked, onChange,
}: {
  icon: React.ElementType; iconBg: string; title: string; desc: string;
  checked: boolean; onChange: (v: boolean) => void;
}) => (
  <div className="flex items-center justify-between gap-4 py-3.5">
    <div className="flex min-w-0 items-center gap-3">
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', iconBg)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{title}</p>
        <p className="truncate text-xs text-slate-400">{desc}</p>
      </div>
    </div>
    <Toggle checked={checked} onChange={onChange} />
  </div>
);

export const NotificationSettings = () => {
  const { user, updateUser } = useAuthStore();
  const { addToast } = useUIStore();
  const {
    soundEnabled, setSoundEnabled,
    notifyTaskAssigned, notifyTaskUpdated, notifyTaskCompleted, notifyComments, notifyDueReminders, notifyTeamEvents,
    setNotifyPref,
  } = usePrefsStore();
  const [emailNotif, setEmailNotif] = useState(user?.emailNotifications !== false);

  const handleEmailNotif = async (v: boolean) => {
    setEmailNotif(v);
    try {
      const updated = await authService.updateMe({ emailNotifications: v });
      updateUser(updated);
    } catch {
      setEmailNotif(!v);
      addToast({ type: 'error', title: 'Failed to update email setting' });
    }
  };

  return (
    <div className="card space-y-1">
      {/* Card header */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/10">
          <Bell className="h-5 w-5 text-brand-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Notifications</h3>
          <p className="text-xs text-slate-400">Control what reaches you and how.</p>
        </div>
      </div>

      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        Sound & alerts
      </p>

      {/* Sound toggle — highlighted */}
      <div className={cn(
        'mb-2 flex items-center justify-between gap-4 rounded-xl border p-4 transition-colors',
        soundEnabled
          ? 'border-brand-200/70 bg-brand-50 dark:border-brand-500/20 dark:bg-brand-500/10'
          : 'border-slate-200/70 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50'
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex h-11 w-11 items-center justify-center rounded-xl',
            soundEnabled ? 'bg-brand-100 dark:bg-brand-500/20' : 'bg-slate-200 dark:bg-slate-700'
          )}>
            {soundEnabled
              ? <Volume2 className="h-5 w-5 text-brand-600 dark:text-brand-400" />
              : <VolumeX className="h-5 w-5 text-slate-400" />}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Notification sounds</p>
            <p className="text-xs text-slate-400">{soundEnabled ? 'Sounds are enabled' : 'All sounds are muted'}</p>
          </div>
        </div>
        <Toggle checked={soundEnabled} onChange={setSoundEnabled} />
      </div>

      <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Notification types</p>
        <p className="mb-2 text-xs text-slate-400">Choose which events trigger a notification bell.</p>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          <NotifRow icon={Mail} iconBg="bg-brand-100 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400"
            title="Email notifications" desc="Email me about task assignments, mentions and due reminders"
            checked={emailNotif} onChange={handleEmailNotif} />
          <NotifRow icon={Zap} iconBg="bg-brand-100 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400"
            title="Task Assigned" desc="When someone assigns a task to you"
            checked={notifyTaskAssigned} onChange={(v) => setNotifyPref('notifyTaskAssigned', v)} />
          <NotifRow icon={AlertCircle} iconBg="bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400"
            title="Task Updated" desc="When a task you're on is modified"
            checked={notifyTaskUpdated} onChange={(v) => setNotifyPref('notifyTaskUpdated', v)} />
          <NotifRow icon={CheckCircle2} iconBg="bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400"
            title="Task Completed" desc="When a task you're on is marked done"
            checked={notifyTaskCompleted} onChange={(v) => setNotifyPref('notifyTaskCompleted', v)} />
          <NotifRow icon={MessageSquare} iconBg="bg-sky-100 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400"
            title="Comments & Mentions" desc="When someone comments on or @mentions you on a task"
            checked={notifyComments} onChange={(v) => setNotifyPref('notifyComments', v)} />
          <NotifRow icon={CalendarClock} iconBg="bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400"
            title="Due Reminders" desc="When a task is due soon or overdue"
            checked={notifyDueReminders} onChange={(v) => setNotifyPref('notifyDueReminders', v)} />
          <NotifRow icon={Users} iconBg="bg-brand-100 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400"
            title="Team Events" desc="Invites, new members joining your team"
            checked={notifyTeamEvents} onChange={(v) => setNotifyPref('notifyTeamEvents', v)} />
        </div>
      </div>

      {/* All-off warning */}
      {!notifyTaskAssigned && !notifyTaskUpdated && !notifyTaskCompleted && !notifyTeamEvents && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200/70 bg-amber-50 px-4 py-3 text-xs text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
          <BellOff className="mt-0.5 h-4 w-4 shrink-0" />
          <span>All notifications are disabled. You won't be alerted to any activity.</span>
        </div>
      )}
    </div>
  );
};
