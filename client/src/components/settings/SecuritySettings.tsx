import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Lock, Download, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { authService } from '@/services/authService';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { TwoFactorSettings } from '@/components/settings/TwoFactorSettings';

export const SecuritySettings = () => {
  const { logout } = useAuthStore();
  const { addToast, showConfirm } = useUIStore();
  const [pwSaving, setPwSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { register: regPw, handleSubmit: handlePw, reset: resetPw, formState: { errors: pwErrors } } = useForm<{
    currentPassword: string; newPassword: string; confirmPassword: string;
  }>();

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

  return (
    <div className="space-y-6">
      <TwoFactorSettings />
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
            label="Current Password" type="password" placeholder="••••••••"
            error={pwErrors.currentPassword?.message}
            {...regPw('currentPassword', { required: 'Current password required' })}
          />
          <Input
            label="New Password" type="password" placeholder="Min 8 characters"
            error={pwErrors.newPassword?.message}
            {...regPw('newPassword', { required: 'New password required', minLength: { value: 8, message: 'Min 8 characters' } })}
          />
          <Input
            label="Confirm New Password" type="password" placeholder="••••••••"
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
  );
};
