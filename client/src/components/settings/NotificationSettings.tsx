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
      'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900',
      checked ? 'bg-brand-500' : 'bg-slate-200 dark:bg-slate-700'
    )}
    aria-checked={checked}
    role="switch"
  >
    <span
      className={cn(
        'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200',
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
    <div className="flex items-center gap-3 min-w-0">
      <div className={cn('shrink-0 rounded-lg p-2', iconBg)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{title}</p>
        <p className="text-xs text-slate-400 truncate">{desc}</p>
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
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
        Sound & Alerts
      </p>

      {/* Sound toggle — highlighted */}
      <div className={cn(
        'flex items-center justify-between gap-4 rounded-xl p-4 mb-2',
        soundEnabled ? 'bg-brand-50 dark:bg-brand-500/10' : 'bg-slate-50 dark:bg-slate-800/50'
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            'rounded-lg p-2.5',
            soundEnabled ? 'bg-brand-100 dark:bg-brand-500/20' : 'bg-slate-200 dark:bg-slate-700'
          )}>
            {soundEnabled
              ? <Volume2 className="h-5 w-5 text-brand-600 dark:text-brand-400" />
              : <VolumeX className="h-5 w-5 text-slate-400" />}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Notification Sounds</p>
            <p className="text-xs text-slate-400">{soundEnabled ? 'Sounds are enabled' : 'All sounds are muted'}</p>
          </div>
        </div>
        <Toggle checked={soundEnabled} onChange={setSoundEnabled} />
      </div>

      <div className="border-t border-slate-100 dark:border-slate-700/50 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Notification Types</p>
        <p className="text-xs text-slate-400 mb-3">Choose which events trigger a notification bell.</p>

        <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
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
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
          <BellOff className="h-4 w-4 shrink-0" />
          All notifications are disabled. You won't be alerted to any activity.
        </div>
      )}
    </div>
  );
};
