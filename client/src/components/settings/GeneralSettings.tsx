import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { Globe, UserCircle } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { authService } from '@/services/authService';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { getUserTimeZone, setUserTimeZone } from '@/lib/utils';

// Full IANA zone list where supported, with a sensible fallback for older runtimes.
const TIMEZONES: string[] =
  (Intl as any).supportedValuesOf?.('timeZone') ?? [
    'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow',
    'Africa/Cairo', 'Africa/Lagos', 'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata',
    'Asia/Dhaka', 'Asia/Singapore', 'Asia/Shanghai', 'Asia/Tokyo', 'Australia/Sydney',
    'Pacific/Auckland',
  ];

export const GeneralSettings = () => {
  const { t } = useTranslation();
  const { user, updateUser } = useAuthStore();
  const { addToast } = useUIStore();
  const [profileSaving, setProfileSaving] = useState(false);
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

  return (
    <div className="card space-y-6">
      {/* Card header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/10">
          <UserCircle className="h-5 w-5 text-brand-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('settings.tabs.general')}</h3>
          <p className="text-xs text-slate-400">Your personal details and where you work.</p>
        </div>
      </div>

      {/* Identity row — warm surface */}
      <div className="flex items-center gap-4 rounded-xl border border-slate-200/70 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40">
        <Avatar name={user?.name || 'User'} src={user?.avatar} size="lg" />
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{user?.name}</p>
          <p className="truncate text-sm text-slate-400">{user?.email}</p>
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
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
            {t('settings.emailAddress')}
          </label>
          <input
            value={user?.email || ''}
            disabled
            readOnly
            className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-500"
          />
          <p className="mt-1 text-xs text-slate-400">{t('settings.emailCannotChange')}</p>
        </div>
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
            <Globe className="h-3.5 w-3.5 text-slate-400" /> {t('settings.timezone')}
          </label>
          <select
            value={timezone}
            onChange={(e) => handleTimezoneChange(e.target.value)}
            className="input-field"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-400">{t('settings.timezoneHint')}</p>
        </div>
        <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button type="submit" isLoading={profileSaving} size="sm">
            {t('common.saveChanges')}
          </Button>
        </div>
      </form>
    </div>
  );
};
