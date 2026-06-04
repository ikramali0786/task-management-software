import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, Lock, AlertCircle, UserX, KeyRound, Eye, EyeOff, ShieldAlert,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { AuthLayout } from '@/components/auth/AuthLayout';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormData { email: string; password: string; rememberMe: boolean; }
type ErrorField = 'email' | 'password' | 'general' | 'locked';
interface ApiError { message: string; field: ErrorField; }

// ── Component ─────────────────────────────────────────────────────────────────

export const LoginPage = () => {
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/';

  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    defaultValues: { rememberMe: false },
  });

  const classifyError = (message: string): ErrorField => {
    const lower = message.toLowerCase();
    if (lower.includes('locked') || lower.includes('too many'))  return 'locked';
    if (lower.includes('account') || lower.includes('email'))    return 'email';
    if (lower.includes('password'))                              return 'password';
    return 'general';
  };

  const onSubmit = async (data: FormData) => {
    setApiError(null);
    try {
      await login(data.email, data.password, data.rememberMe);
      navigate(from, { replace: true });
    } catch (err: any) {
      const message = err.response?.data?.message || 'Something went wrong. Please try again.';
      setApiError({ message, field: classifyError(message) });
    }
  };

  const clearError = () => { if (apiError) setApiError(null); };

  const ErrorIcon =
    apiError?.field === 'email' ? UserX
    : apiError?.field === 'password' ? KeyRound
    : AlertCircle;

  return (
    <AuthLayout heading="Welcome back" subheading="Sign in to continue to your workspace.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Input
          label="Email address"
          type="email"
          placeholder="you@example.com"
          leftIcon={<Mail className="h-4 w-4" />}
          error={
            errors.email?.message ||
            (apiError?.field === 'email' ? apiError.message : undefined)
          }
          {...register('email', { required: 'Email is required' })}
          onChange={(e) => { clearError(); register('email').onChange(e); }}
        />

        <Input
          label="Password"
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
          error={
            errors.password?.message ||
            (apiError?.field === 'password' ? apiError.message : undefined)
          }
          {...register('password', { required: 'Password is required' })}
          onChange={(e) => { clearError(); register('password').onChange(e); }}
        />

        {/* Remember me + forgot password */}
        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2.5">
            <div className="relative flex-shrink-0">
              <input type="checkbox" className="peer sr-only" {...register('rememberMe')} />
              <div className="h-4 w-4 rounded border border-slate-300 bg-white transition-all peer-checked:border-brand-500 peer-checked:bg-brand-500 dark:border-slate-600 dark:bg-slate-800" />
              <svg
                className="pointer-events-none absolute inset-0 h-4 w-4 scale-0 text-white transition-transform peer-checked:scale-100"
                fill="none"
                viewBox="0 0 16 16"
              >
                <path d="M3.5 8l3 3 5.5-5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-sm text-slate-600 dark:text-slate-400">Remember me</span>
          </label>
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
          >
            Forgot password?
          </Link>
        </div>

        {/* Account locked banner */}
        <AnimatePresence>
          {apiError?.field === 'locked' && (
            <motion.div
              key="locked"
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -6, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3.5 py-3">
                <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                <div>
                  <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">Account temporarily locked</p>
                  <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-0.5">{apiError.message}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* General error banner */}
        <AnimatePresence>
          {apiError?.field === 'general' && (
            <motion.div
              key="err"
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -6, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-3">
                <ErrorIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
                <p className="text-sm text-red-400">{apiError.message}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Button type="submit" className="w-full" isLoading={isLoading}>
          Sign In
        </Button>
      </form>

      {/* Divider */}
      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-slate-700" />
        <span className="text-xs text-slate-400">or</span>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-slate-700" />
      </div>

      {/* Register link */}
      <p className="text-center text-sm text-slate-500">
        Don&apos;t have an account?{' '}
        <Link
          to="/register"
          className="font-semibold text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
        >
          Create one free
        </Link>
      </p>
    </AuthLayout>
  );
};
