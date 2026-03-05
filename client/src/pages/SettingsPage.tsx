import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Lock, Sun, Moon, Monitor, Bell, BellOff,
  Volume2, VolumeX, CheckCircle2, AlertCircle, Users, Zap,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { usePrefsStore } from '@/store/prefsStore';
import { authService } from '@/services/authService';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { Theme } from '@/types';

type Tab = 'general' | 'notifications' | 'security' | 'appearance';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'general', label: 'General', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Lock },
  { id: 'appearance', label: 'Appearance', icon: Sun },
];

const themeOptions: { value: Theme; label: string; icon: React.ElementType; desc: string }[] = [
  { value: 'light', label: 'Light', icon: Sun, desc: 'Clean and bright' },
  { value: 'dark', label: 'Dark', icon: Moon, desc: 'Easy on the eyes' },
  { value: 'system', label: 'System', icon: Monitor, desc: 'Follows your OS' },
];

const tabVariants = {
  enter: { opacity: 0, y: 8 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

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
  icon: Icon,
  iconBg,
  title,
  desc,
  checked,
  onChange,
}: {
  icon: React.ElementType;
  iconBg: string;
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
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

/* ─── Main Page ─────────────────────────────────────────── */
export const SettingsPage = () => {
  const { user, updateUser } = useAuthStore();
  const { theme, setTheme, addToast } = useUIStore();
  const {
    soundEnabled, setSoundEnabled,
    notifyTaskAssigned, notifyTaskUpdated, notifyTaskCompleted, notifyTeamEvents,
    setNotifyPref,
  } = usePrefsStore();

  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [profileSaving, setProfileSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  const { register: regProfile, handleSubmit: handleProfile, formState: { errors: peErrors } } = useForm({
    defaultValues: { name: user?.name || '', username: user?.username || '' },
  });

  const { register: regPw, handleSubmit: handlePw, reset: resetPw, formState: { errors: pwErrors } } = useForm<{
    currentPassword: string; newPassword: string; confirmPassword: string;
  }>();

  const onProfileSave = async (data: { name: string; username: string }) => {
    setProfileSaving(true);
    try {
      const updated = await authService.updateMe({ name: data.name, username: data.username || undefined });
      updateUser(updated);
      addToast({ type: 'success', title: 'Profile updated' });
    } catch {
      addToast({ type: 'error', title: 'Failed to update profile' });
    } finally {
      setProfileSaving(false);
    }
  };

  const onPwSave = async (data: { currentPassword: string; newPassword: string; confirmPassword: string }) => {
    if (data.newPassword !== data.confirmPassword) {
      addToast({ type: 'error', title: 'Passwords do not match' });
      return;
    }
    setPwSaving(true);
    try {
      await authService.changePassword({ currentPassword: data.currentPassword, newPassword: data.newPassword });
      addToast({ type: 'success', title: 'Password changed successfully' });
      resetPw();
    } catch (err: any) {
      addToast({ type: 'error', title: err.response?.data?.message || 'Failed to change password' });
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Settings</h2>
        <p className="text-sm text-slate-500 mt-1">Manage your account, preferences and notifications.</p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/60">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all',
              activeTab === id
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:block">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          variants={tabVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.15 }}
        >
          {/* ── GENERAL ── */}
          {activeTab === 'general' && (
            <div className="card space-y-6">
              {/* Avatar row */}
              <div className="flex items-center gap-4">
                <Avatar name={user?.name || 'User'} src={user?.avatar} size="lg" />
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{user?.name}</p>
                  <p className="text-sm text-slate-400">{user?.email}</p>
                </div>
              </div>

              <form onSubmit={handleProfile(onProfileSave)} className="space-y-4">
                <Input
                  label="Full Name"
                  placeholder="John Doe"
                  error={peErrors.name?.message}
                  {...regProfile('name', { required: 'Name is required' })}
                />
                <Input
                  label="Username"
                  placeholder="johndoe"
                  {...regProfile('username')}
                />
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                    Email address
                  </label>
                  <input
                    value={user?.email || ''}
                    disabled
                    readOnly
                    className="w-full rounded-xl border border-slate-100 bg-slate-100 px-4 py-2.5 text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-500 cursor-not-allowed"
                  />
                  <p className="mt-1 text-xs text-slate-400">Email cannot be changed.</p>
                </div>
                <div className="pt-1">
                  <Button type="submit" isLoading={profileSaving} size="sm">
                    Save Changes
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* ── NOTIFICATIONS ── */}
          {activeTab === 'notifications' && (
            <div className="card space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Sound & Alerts
              </p>

              {/* Sound toggle — highlighted */}
              <div className={cn(
                'flex items-center justify-between gap-4 rounded-xl p-4 mb-2',
                soundEnabled
                  ? 'bg-brand-50 dark:bg-brand-500/10'
                  : 'bg-slate-50 dark:bg-slate-800/50'
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'rounded-lg p-2.5',
                    soundEnabled
                      ? 'bg-brand-100 dark:bg-brand-500/20'
                      : 'bg-slate-200 dark:bg-slate-700'
                  )}>
                    {soundEnabled
                      ? <Volume2 className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                      : <VolumeX className="h-5 w-5 text-slate-400" />
                    }
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      Notification Sounds
                    </p>
                    <p className="text-xs text-slate-400">
                      {soundEnabled ? 'Sounds are enabled' : 'All sounds are muted'}
                    </p>
                  </div>
                </div>
                <Toggle checked={soundEnabled} onChange={setSoundEnabled} />
              </div>

              <div className="border-t border-slate-100 dark:border-slate-700/50 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Notification Types
                </p>
                <p className="text-xs text-slate-400 mb-3">
                  Choose which events trigger a notification bell.
                </p>

                <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  <NotifRow
                    icon={Zap}
                    iconBg="bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                    title="Task Assigned"
                    desc="When someone assigns a task to you"
                    checked={notifyTaskAssigned}
                    onChange={(v) => setNotifyPref('notifyTaskAssigned', v)}
                  />
                  <NotifRow
                    icon={AlertCircle}
                    iconBg="bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    title="Task Updated"
                    desc="When a task you're on is modified"
                    checked={notifyTaskUpdated}
                    onChange={(v) => setNotifyPref('notifyTaskUpdated', v)}
                  />
                  <NotifRow
                    icon={CheckCircle2}
                    iconBg="bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400"
                    title="Task Completed"
                    desc="When a task you're on is marked done"
                    checked={notifyTaskCompleted}
                    onChange={(v) => setNotifyPref('notifyTaskCompleted', v)}
                  />
                  <NotifRow
                    icon={Users}
                    iconBg="bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400"
                    title="Team Events"
                    desc="Invites, new members joining your team"
                    checked={notifyTeamEvents}
                    onChange={(v) => setNotifyPref('notifyTeamEvents', v)}
                  />
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
          )}

          {/* ── SECURITY ── */}
          {activeTab === 'security' && (
            <div className="card">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-xl bg-slate-100 p-2 dark:bg-slate-800">
                  <Lock className="h-4 w-4 text-slate-500" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Change Password</h3>
                  <p className="text-xs text-slate-400">Use a strong password you don't use elsewhere.</p>
                </div>
              </div>
              <form onSubmit={handlePw(onPwSave)} className="space-y-4">
                <Input
                  label="Current Password"
                  type="password"
                  placeholder="••••••••"
                  error={pwErrors.currentPassword?.message}
                  {...regPw('currentPassword', { required: 'Current password required' })}
                />
                <Input
                  label="New Password"
                  type="password"
                  placeholder="Min 8 characters"
                  error={pwErrors.newPassword?.message}
                  {...regPw('newPassword', {
                    required: 'New password required',
                    minLength: { value: 8, message: 'Min 8 characters' },
                  })}
                />
                <Input
                  label="Confirm New Password"
                  type="password"
                  placeholder="••••••••"
                  error={pwErrors.confirmPassword?.message}
                  {...regPw('confirmPassword', { required: 'Please confirm your password' })}
                />
                <Button type="submit" isLoading={pwSaving} size="sm" variant="secondary">
                  Update Password
                </Button>
              </form>
            </div>
          )}

          {/* ── APPEARANCE ── */}
          {activeTab === 'appearance' && (
            <div className="card">
              <h3 className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">Theme</h3>
              <p className="mb-5 text-xs text-slate-400">Choose how TaskFlow looks to you.</p>
              <div className="grid grid-cols-3 gap-3">
                {themeOptions.map(({ value, label, icon: Icon, desc }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={cn(
                      'flex flex-col items-center gap-3 rounded-xl border py-5 text-center transition-all',
                      theme === value
                        ? 'border-brand-400 bg-brand-50 dark:border-brand-600 dark:bg-brand-500/10'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600'
                    )}
                  >
                    <div className={cn(
                      'rounded-lg p-2',
                      theme === value
                        ? 'bg-brand-100 dark:bg-brand-500/20'
                        : 'bg-slate-200 dark:bg-slate-700'
                    )}>
                      <Icon className={cn(
                        'h-5 w-5',
                        theme === value
                          ? 'text-brand-600 dark:text-brand-400'
                          : 'text-slate-500 dark:text-slate-400'
                      )} />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-semibold',
                        theme === value
                          ? 'text-brand-700 dark:text-brand-300'
                          : 'text-slate-700 dark:text-slate-300'
                      )}>{label}</p>
                      <p className="text-xs text-slate-400">{desc}</p>
                    </div>
                    {theme === value && (
                      <span className="text-xs font-medium text-brand-600 dark:text-brand-400">Active</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
