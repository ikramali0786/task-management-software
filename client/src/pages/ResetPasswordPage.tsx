import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import {
  Lock, Eye, EyeOff, Zap, ArrowLeft, CheckCircle2, XCircle, Check,
} from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { authService } from '@/services/authService';
import { cn } from '@/lib/utils';

interface FormData { password: string; confirmPassword: string; }

const Rule = ({ ok, label }: { ok: boolean; label: string }) => (
  <li className={cn('flex items-center gap-2 text-xs', ok ? 'text-emerald-500' : 'text-slate-400')}>
    <Check className={cn('h-3.5 w-3.5', ok ? 'opacity-100' : 'opacity-30')} />
    {label}
  </li>
);

export const ResetPasswordPage = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } =
    useForm<FormData>();
  const password = watch('password', '');

  const lengthOk  = password.length >= 8 && password.length <= 128;
  const hasUpper  = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    try {
      await authService.resetPassword({ token, password: data.password });
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true }), 2500);
    } catch (err: any) {
      setServerError(err.response?.data?.message || 'Could not reset password. Please try again.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12 dark:bg-slate-950">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold text-slate-900 dark:text-slate-100">TaskFlow</span>
        </div>

        {!token ? (
          <div className="text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
              <XCircle className="h-7 w-7 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Invalid link</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              This reset link is missing its token. Please request a new one.
            </p>
            <Link to="/forgot-password" className="mt-8 inline-block btn-primary">
              Request new link
            </Link>
          </div>
        ) : done ? (
          <div className="text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-7 w-7 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Password reset</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Your password has been updated. Redirecting you to sign in…
            </p>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Set a new password</h2>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                Choose a strong password you don't use elsewhere.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <Input
                label="New password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                leftIcon={<Lock className="h-4 w-4" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
                error={errors.password?.message}
                {...register('password', {
                  required: 'Password is required',
                  validate: (v) =>
                    (v.length >= 8 && v.length <= 128 && /[A-Z]/.test(v) && /[0-9]/.test(v) && /[^a-zA-Z0-9]/.test(v)) ||
                    'Password does not meet all requirements',
                })}
              />

              <ul className="grid grid-cols-2 gap-y-1.5">
                <Rule ok={lengthOk}  label="8–128 characters" />
                <Rule ok={hasUpper}  label="Uppercase letter" />
                <Rule ok={hasNumber} label="A number" />
                <Rule ok={hasSpecial} label="A special character" />
              </ul>

              <Input
                label="Confirm password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                leftIcon={<Lock className="h-4 w-4" />}
                error={errors.confirmPassword?.message}
                {...register('confirmPassword', {
                  required: 'Please confirm your password',
                  validate: (v) => v === password || 'Passwords do not match',
                })}
              />

              {serverError && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-3">
                  <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
                  <p className="text-sm text-red-400">{serverError}</p>
                </div>
              )}

              <Button type="submit" className="w-full" isLoading={isSubmitting}>
                Reset password
              </Button>
            </form>

            <Link
              to="/login"
              className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-700 dark:hover:text-slate-300"
            >
              <ArrowLeft className="h-4 w-4" /> Back to sign in
            </Link>
          </>
        )}
      </motion.div>
    </div>
  );
};
