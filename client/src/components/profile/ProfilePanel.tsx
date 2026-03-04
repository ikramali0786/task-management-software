import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, AtSign, Camera, Lock, LogOut, Sun, Moon, Monitor, Save, Eye, EyeOff } from 'lucide-react';
import { Slideover } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { authService } from '@/services/authService';
import { cn } from '@/lib/utils';
import { Theme } from '@/types';

interface ProfilePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export const ProfilePanel = ({ isOpen, onClose }: ProfilePanelProps) => {
  const { user, logout, updateUser } = useAuthStore();
  const { theme, setTheme, addToast } = useUIStore();

  const [tab, setTab] = useState<'profile' | 'password'>('profile');

  // Profile form state
  const [name, setName] = useState(user?.name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password form state
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [pwError, setPwError] = useState('');

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const updates: Record<string, any> = {};
      if (name.trim() && name !== user?.name) updates.name = name.trim();
      if (username.trim() && username !== user?.username) updates.username = username.trim().toLowerCase();
      if (avatarUrl !== (user?.avatar || '')) updates.avatar = avatarUrl || null;
      if (Object.keys(updates).length === 0) {
        addToast({ type: 'info', title: 'No changes to save' });
        setSavingProfile(false);
        return;
      }
      const updated = await authService.updateMe(updates);
      updateUser(updated);
      addToast({ type: 'success', title: 'Profile updated' });
    } catch (err: any) {
      addToast({ type: 'error', title: err.response?.data?.message || 'Failed to update profile' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    setPwError('');
    if (newPw.length < 8) { setPwError('New password must be at least 8 characters.'); return; }
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return; }
    setSavingPw(true);
    try {
      await authService.changePassword({ currentPassword: currentPw, newPassword: newPw });
      addToast({ type: 'success', title: 'Password changed successfully' });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err: any) {
      setPwError(err.response?.data?.message || 'Failed to change password');
    } finally {
      setSavingPw(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  return (
    <Slideover isOpen={isOpen} onClose={onClose} title="Profile" width="max-w-sm">
      <div className="flex h-full flex-col">
        {/* Avatar section */}
        <div className="flex flex-col items-center gap-3 border-b border-slate-100 px-6 py-6 dark:border-slate-800">
          <div className="relative">
            <Avatar name={user?.name || 'User'} src={user?.avatar} size="xl" />
            {user?.avatar && (
              <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 ring-2 ring-white dark:ring-slate-900">
                <Camera className="h-3.5 w-3.5 text-white" />
              </div>
            )}
          </div>
          <div className="text-center">
            <p className="font-semibold text-slate-900 dark:text-white">{user?.name}</p>
            {user?.username && (
              <p className="text-sm text-slate-400">@{user.username}</p>
            )}
            <p className="text-xs text-slate-400">{user?.email}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-800">
          {(['profile', 'password'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex-1 py-3 text-sm font-medium capitalize transition-colors',
                tab === t
                  ? 'border-b-2 border-brand-500 text-brand-600 dark:text-brand-400'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              )}
            >
              {t === 'profile' ? 'Edit Profile' : 'Change Password'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === 'profile' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <Input
                label="Full Name"
                leftIcon={<User className="h-4 w-4" />}
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                placeholder="Your full name"
              />
              <Input
                label="Username"
                leftIcon={<AtSign className="h-4 w-4" />}
                value={username}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value.toLowerCase())}
                placeholder="yourname1234"
              />
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Avatar URL (optional)</label>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
              </div>

              {/* Theme */}
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-500">Theme</label>
                <div className="flex gap-2">
                  {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => setTheme(value)}
                      className={cn(
                        'flex flex-1 flex-col items-center gap-1.5 rounded-xl border py-2.5 text-xs font-medium transition-all',
                        theme === value
                          ? 'border-brand-400 bg-brand-50 text-brand-600 dark:border-brand-500 dark:bg-brand-500/10 dark:text-brand-400'
                          : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <Button onClick={handleSaveProfile} isLoading={savingProfile} className="w-full gap-2">
                <Save className="h-4 w-4" />
                Save Changes
              </Button>
            </motion.div>
          )}

          {tab === 'password' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="relative">
                <Input
                  label="Current Password"
                  type={showCurrentPw ? 'text' : 'password'}
                  leftIcon={<Lock className="h-4 w-4" />}
                  value={currentPw}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentPw(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw(!showCurrentPw)}
                  className="absolute right-3 top-8 text-slate-400 hover:text-slate-600"
                >
                  {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="relative">
                <Input
                  label="New Password"
                  type={showNewPw ? 'text' : 'password'}
                  leftIcon={<Lock className="h-4 w-4" />}
                  value={newPw}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPw(e.target.value)}
                  placeholder="Min 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-3 top-8 text-slate-400 hover:text-slate-600"
                >
                  {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Input
                label="Confirm New Password"
                type="password"
                leftIcon={<Lock className="h-4 w-4" />}
                value={confirmPw}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPw(e.target.value)}
                placeholder="Re-enter new password"
              />

              {pwError && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600 dark:border-red-800/50 dark:bg-red-500/10 dark:text-red-400">
                  {pwError}
                </p>
              )}

              <Button onClick={handleChangePassword} isLoading={savingPw} className="w-full gap-2">
                <Lock className="h-4 w-4" />
                Change Password
              </Button>
            </motion.div>
          )}
        </div>

        {/* Logout */}
        <div className="border-t border-slate-100 px-6 py-4 dark:border-slate-800">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </div>
    </Slideover>
  );
};
