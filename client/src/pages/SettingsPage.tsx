import { useState, useEffect, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Lock, Sun, Moon, Monitor, Bell, BellOff,
  Volume2, VolumeX, CheckCircle2, AlertCircle, Users, Zap,
  Settings as SettingsIcon, Crown, Check, Sparkles, MessageSquare, CalendarClock, Mail,
  Download, AlertTriangle, Minus, Globe, Code2,
} from 'lucide-react';
import { DeveloperSettings } from '@/components/settings/DeveloperSettings';
import { AutomationSettings } from '@/components/settings/AutomationSettings';
import { PageHeader } from '@/components/layout/PageContainer';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { usePrefsStore } from '@/store/prefsStore';
import { usePlan } from '@/hooks/usePlan';
import { LANGUAGES } from '@/i18n';
import { useTeamStore } from '@/store/teamStore';
import { billingService } from '@/services/billingService';
import { FEATURE_MATRIX, PLAN_PRICES, PLAN_LABELS } from '@/lib/plans';
import { authService } from '@/services/authService';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { cn, getUserTimeZone, setUserTimeZone } from '@/lib/utils';
import { Theme } from '@/types';

type Tab = 'general' | 'billing' | 'notifications' | 'automations' | 'security' | 'appearance' | 'developer';

const TABS: { id: Tab; i18nKey: string; icon: React.ElementType }[] = [
  { id: 'general', i18nKey: 'settings.tabs.general', icon: User },
  { id: 'billing', i18nKey: 'settings.tabs.billing', icon: Crown },
  { id: 'notifications', i18nKey: 'settings.tabs.notifications', icon: Bell },
  { id: 'automations', i18nKey: 'settings.tabs.automations', icon: Zap },
  { id: 'developer', i18nKey: 'settings.tabs.developer', icon: Code2 },
  { id: 'security', i18nKey: 'settings.tabs.security', icon: Lock },
  { id: 'appearance', i18nKey: 'settings.tabs.appearance', icon: Sun },
];

// Full IANA zone list where supported, with a sensible fallback for older runtimes.
const TIMEZONES: string[] =
  (Intl as any).supportedValuesOf?.('timeZone') ?? [
    'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow',
    'Africa/Cairo', 'Africa/Lagos', 'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata',
    'Asia/Dhaka', 'Asia/Singapore', 'Asia/Shanghai', 'Asia/Tokyo', 'Australia/Sydney',
    'Pacific/Auckland',
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

/* ─── Usage Meter ───────────────────────────────────────── */
const UsageMeter = ({ label, used, max }: { label: string; used: number; max: number | null }) => {
  const unlimited = max === null || !Number.isFinite(max);
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(1, max!)) * 100));
  const near = !unlimited && pct >= 80;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/40">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {used}
          <span className="text-slate-400"> / {unlimited ? '∞' : max}</span>
        </p>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            unlimited ? 'bg-emerald-400' : near ? 'bg-amber-500' : 'bg-brand-500'
          )}
          style={{ width: unlimited ? '100%' : `${pct}%`, opacity: unlimited ? 0.4 : 1 }}
        />
      </div>
    </div>
  );
};

/* ─── Plan comparison cell ──────────────────────────────── */
const comparisonCell = (value: string, accent: boolean) => {
  if (value === '—') return <Minus className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />;
  if (value === 'Included')
    return (
      <span
        className={cn(
          'inline-flex h-5 w-5 items-center justify-center rounded-full',
          accent ? 'bg-brand-500 shadow-sm shadow-brand-500/30' : 'bg-emerald-500'
        )}
      >
        <Check className="h-3 w-3 text-white" strokeWidth={3} />
      </span>
    );
  return <span className={accent ? 'font-medium text-slate-900 dark:text-slate-100' : ''}>{value}</span>;
};

/* ─── Main Page ─────────────────────────────────────────── */
export const SettingsPage = () => {
  const { t, i18n } = useTranslation();
  const { user, updateUser, logout } = useAuthStore();
  const { theme, setTheme, addToast, openUpgrade, showConfirm } = useUIStore();
  const { plan, isPro, limits, aiUsed, memberUsage, billingEnabled, team } = usePlan();
  const fetchTeams = useTeamStore((s) => s.fetchTeams);
  const [searchParams, setSearchParams] = useSearchParams();
  const [portalLoading, setPortalLoading] = useState(false);
  const {
    soundEnabled, setSoundEnabled,
    notifyTaskAssigned, notifyTaskUpdated, notifyTaskCompleted, notifyComments, notifyDueReminders, notifyTeamEvents,
    setNotifyPref,
  } = usePrefsStore();

  // Handle the return from Stripe Checkout / Customer Portal.
  useEffect(() => {
    const status = searchParams.get('billing');
    if (!status) return;
    if (status === 'success') {
      addToast({ type: 'success', title: 'Welcome to Pro! 🎉', message: 'Your subscription is active.' });
      fetchTeams();
    } else if (status === 'cancelled') {
      addToast({ type: 'info', title: 'Checkout cancelled', message: 'No changes were made.' });
    } else if (status === 'portal') {
      fetchTeams();
    }
    searchParams.delete('billing');
    setSearchParams(searchParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManageBilling = async () => {
    if (!team) return;
    setPortalLoading(true);
    try {
      await billingService.portal(team._id);
    } catch (err: any) {
      setPortalLoading(false);
      addToast({ type: 'error', title: "Couldn't open billing portal", message: err?.response?.data?.message || 'Please try again.' });
    }
  };

  const [activeTab, setActiveTab] = useState<Tab>(searchParams.get('billing') ? 'billing' : 'general');
  const [emailNotif, setEmailNotif] = useState(user?.emailNotifications !== false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await authService.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `taskflow-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast({ type: 'success', title: 'Export ready', message: 'Your data download has started.' });
    } catch {
      addToast({ type: 'error', title: 'Export failed', message: 'Please try again.' });
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = await showConfirm({
      title: 'Delete your account?',
      message:
        'This permanently deletes your account and any teams you solely own, including their tasks. This cannot be undone.',
      confirmLabel: 'Delete account',
      variant: 'danger',
    });
    if (!confirmed) return;
    setDeleting(true);
    try {
      await authService.deleteAccount();
      addToast({ type: 'success', title: 'Account deleted' });
      await logout();
      window.location.href = '/login';
    } catch (err: any) {
      setDeleting(false);
      addToast({
        type: 'error',
        title: "Couldn't delete account",
        message: err?.response?.data?.message || 'Please try again.',
      });
    }
  };

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
  const [profileSaving, setProfileSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [timezone, setTimezone] = useState(user?.timezone || getUserTimeZone());

  const handleTimezoneChange = async (tz: string) => {
    const prev = timezone;
    setTimezone(tz);
    setUserTimeZone(tz);
    try {
      const updated = await authService.updateMe({ timezone: tz });
      updateUser(updated);
      addToast({ type: 'success', title: 'Timezone updated' });
    } catch {
      setTimezone(prev);
      setUserTimeZone(prev);
      addToast({ type: 'error', title: 'Failed to update timezone' });
    }
  };

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
    <div className="mx-auto w-full max-w-2xl p-6 md:p-8 space-y-6">
      <PageHeader
        icon={SettingsIcon}
        title={t('settings.title')}
        description={t('settings.description')}
      />
      {/* space-y handles the gap; PageHeader carries its own mb */}

      {/* Tab Bar */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/60">
        {TABS.map(({ id, i18nKey, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all',
              activeTab === id
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:block">{t(i18nKey)}</span>
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
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{user?.name}</p>
                  <p className="text-sm text-slate-400">{user?.email}</p>
                </div>
              </div>

              <form onSubmit={handleProfile(onProfileSave)} className="space-y-4">
                <Input
                  label={t('settings.fullName')}
                  placeholder="John Doe"
                  error={peErrors.name?.message}
                  {...regProfile('name', { required: 'Name is required' })}
                />
                <Input
                  label={t('settings.username')}
                  placeholder="johndoe"
                  {...regProfile('username')}
                />
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                    {t('settings.emailAddress')}
                  </label>
                  <input
                    value={user?.email || ''}
                    disabled
                    readOnly
                    className="w-full rounded-xl border border-slate-100 bg-slate-100 px-4 py-2.5 text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-500 cursor-not-allowed"
                  />
                  <p className="mt-1 text-xs text-slate-400">{t('settings.emailCannotChange')}</p>
                </div>
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <Globe className="h-3.5 w-3.5" /> {t('settings.timezone')}
                  </label>
                  <select
                    value={timezone}
                    onChange={(e) => handleTimezoneChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-400">{t('settings.timezoneHint')}</p>
                </div>
                <div className="pt-1">
                  <Button type="submit" isLoading={profileSaving} size="sm">
                    {t('common.saveChanges')}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* ── BILLING ── */}
          {activeTab === 'billing' && (
            <div className="space-y-6">
              {/* Current plan card */}
              <div className="card overflow-hidden p-0">
                <div className={cn(
                  'flex items-center justify-between gap-4 px-6 py-5',
                  isPro ? 'gradient-brand text-white' : 'bg-slate-50 dark:bg-slate-800/60'
                )}>
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'flex h-11 w-11 items-center justify-center rounded-xl',
                      isPro ? 'bg-white/15' : 'bg-brand-100 dark:bg-brand-500/15'
                    )}>
                      <Crown className={cn('h-5 w-5', isPro ? 'text-white' : 'text-brand-500')} />
                    </div>
                    <div>
                      <p className={cn('text-xs font-semibold uppercase tracking-wider', isPro ? 'text-white/70' : 'text-slate-400')}>
                        Current plan
                      </p>
                      <p className={cn('text-lg font-bold', isPro ? 'text-white' : 'text-slate-900 dark:text-slate-100')}>
                        TaskFlow {PLAN_LABELS[plan]}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isPro && team?.stripeCustomerId && billingEnabled && (
                      <button
                        onClick={handleManageBilling}
                        disabled={portalLoading}
                        className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/25 disabled:opacity-70"
                      >
                        {portalLoading ? 'Opening…' : 'Manage billing'}
                      </button>
                    )}
                    {plan === 'business' ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
                        <Check className="h-3.5 w-3.5" /> Active
                      </span>
                    ) : (
                      <Button size="sm" variant={isPro ? 'secondary' : 'primary'} onClick={() => openUpgrade()}>
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                        {plan === 'pro' ? 'Upgrade to Business' : 'Upgrade'}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Usage meters (current team) */}
                {team && (
                  <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2">
                    <UsageMeter
                      label="Team members"
                      used={memberUsage.count}
                      max={memberUsage.max}
                    />
                    <UsageMeter
                      label="AI messages this month"
                      used={aiUsed}
                      max={limits.aiMessagesPerMonth}
                    />
                  </div>
                )}
              </div>

              {/* Feature comparison — three tiers */}
              <div className="card">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Compare plans</h3>
                <p className="mb-4 mt-0.5 text-xs text-slate-400">
                  Per-seat pricing — Pro ${PLAN_PRICES.pro.monthly}/seat·mo, Business ${PLAN_PRICES.business.monthly}/seat·mo.
                </p>

                <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="grid grid-cols-[1fr_auto_auto_auto] text-sm">
                    {/* Header row */}
                    <div className="bg-slate-50/60 px-4 py-3 dark:bg-slate-800/40" />
                    <div className="bg-slate-50/60 px-3 py-3 text-center dark:bg-slate-800/40">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Free</p>
                      <p className="mt-0.5 text-[10px] text-slate-400">{plan === 'free' ? 'Your plan' : '$0'}</p>
                    </div>
                    <div className="bg-slate-50/60 px-4 py-3 text-center dark:bg-slate-800/40">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Pro</p>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        {plan === 'pro' ? 'Your plan' : `$${PLAN_PRICES.pro.monthly}/seat`}
                      </p>
                    </div>
                    <div className="bg-brand-50 px-5 py-3 text-center dark:bg-brand-500/10">
                      <p className="flex items-center justify-center gap-1 text-[11px] font-bold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                        <Sparkles className="h-3 w-3" /> Business
                      </p>
                      <p className="mt-0.5 text-[10px] font-medium text-brand-500">
                        {plan === 'business' ? 'Your plan' : `$${PLAN_PRICES.business.monthly}/seat`}
                      </p>
                    </div>

                    {FEATURE_MATRIX.map((row, i) => {
                      const newSection = i === 0 || FEATURE_MATRIX[i - 1].section !== row.section;
                      return (
                        <Fragment key={row.label}>
                          {newSection && (
                            <>
                              <div className="col-span-3 border-t border-slate-200 bg-slate-50/40 px-4 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:border-slate-800 dark:bg-slate-800/30">
                                {row.section}
                              </div>
                              <div className="border-t border-slate-200 bg-brand-50 dark:border-slate-800 dark:bg-brand-500/10" />
                            </>
                          )}
                          <div className="flex items-center border-t border-slate-100 px-4 py-2.5 text-slate-700 dark:border-slate-800/70 dark:text-slate-300">
                            {row.label}
                          </div>
                          <div className="flex items-center justify-center border-t border-slate-100 px-3 py-2.5 text-center text-xs text-slate-500 dark:border-slate-800/70 dark:text-slate-400">
                            {comparisonCell(row.free, false)}
                          </div>
                          <div className="flex items-center justify-center border-t border-slate-100 px-4 py-2.5 text-center text-xs text-slate-600 dark:border-slate-800/70 dark:text-slate-300">
                            {comparisonCell(row.pro, false)}
                          </div>
                          <div className="flex items-center justify-center border-t border-brand-100 bg-brand-50 px-5 py-2.5 text-center text-xs dark:border-brand-500/10 dark:bg-brand-500/10">
                            {comparisonCell(row.business, true)}
                          </div>
                        </Fragment>
                      );
                    })}
                  </div>
                </div>

                {plan !== 'business' && (
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button onClick={() => openUpgrade()}>
                      <Zap className="mr-1.5 h-4 w-4" />
                      {plan === 'pro'
                        ? `Upgrade to Business — $${PLAN_PRICES.business.monthly}/seat·mo`
                        : `Upgrade — from $${PLAN_PRICES.pro.monthly}/seat·mo`}
                    </Button>
                  </div>
                )}
              </div>
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
                    icon={Mail}
                    iconBg="bg-brand-100 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400"
                    title="Email notifications"
                    desc="Email me about task assignments, mentions and due reminders"
                    checked={emailNotif}
                    onChange={handleEmailNotif}
                  />
                  <NotifRow
                    icon={Zap}
                    iconBg="bg-brand-100 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400"
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
                    icon={MessageSquare}
                    iconBg="bg-sky-100 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400"
                    title="Comments & Mentions"
                    desc="When someone comments on or @mentions you on a task"
                    checked={notifyComments}
                    onChange={(v) => setNotifyPref('notifyComments', v)}
                  />
                  <NotifRow
                    icon={CalendarClock}
                    iconBg="bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    title="Due Reminders"
                    desc="When a task is due soon or overdue"
                    checked={notifyDueReminders}
                    onChange={(v) => setNotifyPref('notifyDueReminders', v)}
                  />
                  <NotifRow
                    icon={Users}
                    iconBg="bg-brand-100 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400"
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
            <div className="space-y-6">
            <div className="card">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-xl bg-slate-100 p-2 dark:bg-slate-800">
                  <Lock className="h-4 w-4 text-slate-500" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Change Password</h3>
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

            {/* Data & danger zone */}
            <div className="card">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Your data</h3>
              <p className="mt-0.5 mb-4 text-xs text-slate-400">Export a copy of your data, or permanently delete your account.</p>
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" size="sm" isLoading={exporting} onClick={handleExport}>
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Export my data
                </Button>
              </div>

              <div className="mt-6 rounded-xl border border-red-200 bg-red-50/50 p-4 dark:border-red-900/40 dark:bg-red-500/5">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-red-100 p-2 dark:bg-red-500/15">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-700 dark:text-red-400">Delete account</p>
                    <p className="mt-0.5 text-xs text-red-600/80 dark:text-red-400/70">
                      Permanently deletes your account and any teams you solely own. This cannot be undone.
                    </p>
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleting}
                      className="mt-3 rounded-lg bg-red-500 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                    >
                      {deleting ? 'Deleting…' : 'Delete my account'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            </div>
          )}

          {/* ── AUTOMATIONS ── */}
          {activeTab === 'automations' && <AutomationSettings />}

          {/* ── DEVELOPER ── */}
          {activeTab === 'developer' && <DeveloperSettings />}

          {/* ── APPEARANCE ── */}
          {activeTab === 'appearance' && (
            <div className="card">
              <h3 className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{t('settings.theme')}</h3>
              <p className="mb-5 text-xs text-slate-400">{t('settings.themeHint')}</p>
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

              {/* Language */}
              <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
                <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <Globe className="h-4 w-4 text-slate-400" /> {t('settings.language')}
                </h3>
                <p className="mb-3 text-xs text-slate-400">{t('settings.languageHint')}</p>
                <select
                  value={i18n.resolvedLanguage}
                  onChange={(e) => i18n.changeLanguage(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
