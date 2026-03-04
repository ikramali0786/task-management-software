import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { User, Lock, Sun, Moon, Monitor } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { authService } from '@/services/authService';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { Theme } from '@/types';

const themeOptions: { value: Theme; label: string; icon: React.ElementType }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export const SettingsPage = () => {
  const { user, updateUser } = useAuthStore();
  const { theme, setTheme, addToast } = useUIStore();
  const [profileSaving, setProfileSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  const { register: regProfile, handleSubmit: handleProfile, formState: { errors: peErrors } } = useForm({
    defaultValues: { name: user?.name || '', email: user?.email || '' },
  });

  const { register: regPw, handleSubmit: handlePw, reset: resetPw, formState: { errors: pwErrors } } = useForm<{
    currentPassword: string; newPassword: string;
  }>();

  const onProfileSave = async (data: { name: string; email: string }) => {
    setProfileSaving(true);
    try {
      const updated = await authService.updateMe({ name: data.name });
      updateUser(updated);
      addToast({ type: 'success', title: 'Profile updated' });
    } catch {
      addToast({ type: 'error', title: 'Failed to update profile' });
    } finally {
      setProfileSaving(false);
    }
  };

  const onPwSave = async (data: { currentPassword: string; newPassword: string }) => {
    setPwSaving(true);
    try {
      await authService.changePassword(data);
      addToast({ type: 'success', title: 'Password changed successfully' });
      resetPw();
    } catch (err: any) {
      addToast({ type: 'error', title: err.response?.data?.message || 'Failed to change password' });
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl p-6 space-y-6">
      {/* Profile */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-xl bg-brand-50 p-2 dark:bg-brand-500/10">
            <User className="h-4 w-4 text-brand-500" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Profile</h3>
        </div>

        <div className="mb-5 flex items-center gap-4">
          <Avatar name={user?.name || 'User'} src={user?.avatar} size="lg" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">{user?.name}</p>
            <p className="text-sm text-slate-400">{user?.email}</p>
          </div>
        </div>

        <form onSubmit={handleProfile(onProfileSave)} className="space-y-4">
          <Input
            label="Full Name"
            error={peErrors.name?.message}
            {...regProfile('name', { required: 'Name is required' })}
          />
          <Input
            label="Email"
            type="email"
            disabled
            className="opacity-60"
            {...regProfile('email')}
          />
          <Button type="submit" isLoading={profileSaving} size="sm">
            Save Profile
          </Button>
        </form>
      </motion.div>

      {/* Appearance */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card">
        <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Appearance</h3>
        <div className="flex gap-3">
          {themeOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={cn(
                'flex flex-1 flex-col items-center gap-2 rounded-xl border py-4 text-xs font-medium transition-all',
                theme === value
                  ? 'border-brand-400 bg-brand-50 text-brand-600 dark:border-brand-600 dark:bg-brand-500/10 dark:text-brand-400'
                  : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Change Password */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-xl bg-slate-100 p-2 dark:bg-slate-800">
            <Lock className="h-4 w-4 text-slate-500" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Change Password</h3>
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
            {...regPw('newPassword', { required: 'New password required', minLength: { value: 8, message: 'Min 8 characters' } })}
          />
          <Button type="submit" isLoading={pwSaving} size="sm" variant="secondary">
            Update Password
          </Button>
        </form>
      </motion.div>
    </div>
  );
};
