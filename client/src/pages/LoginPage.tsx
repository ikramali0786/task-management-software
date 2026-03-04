import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { Mail, Lock, Zap, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface FormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

export const LoginPage = () => {
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/';

  const [formError, setFormError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    defaultValues: { rememberMe: false },
  });

  const onSubmit = async (data: FormData) => {
    setFormError(null);
    try {
      await login(data.email, data.password, data.rememberMe);
      navigate(from, { replace: true });
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Invalid email or password. Please try again.');
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left - Branding */}
      <div className="hidden lg:flex lg:flex-1 flex-col items-center justify-center gradient-brand p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full border border-white/30"
              style={{
                width: `${(i + 1) * 150}px`,
                height: `${(i + 1) * 150}px`,
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
              }}
              animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 3 + i, repeat: Infinity, delay: i * 0.5 }}
            />
          ))}
        </div>
        <div className="relative z-10 text-center text-white">
          <div className="mb-6 flex items-center justify-center gap-3">
            <div className="rounded-2xl bg-white/20 p-3 backdrop-blur-sm">
              <Zap className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold">TaskFlow</h1>
          </div>
          <p className="text-xl font-light opacity-90">Manage your team's work,</p>
          <p className="text-xl font-semibold">beautifully and in real-time.</p>
          <div className="mt-10 grid grid-cols-2 gap-4 text-left">
            {['Kanban Boards', 'Real-time Sync', 'Team Collaboration', 'Smart Notifications'].map((f) => (
              <div key={f} className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
                <div className="h-2 w-2 rounded-full bg-white" />
                <span className="text-sm font-medium">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right - Form */}
      <div className="flex flex-1 flex-col items-center justify-center bg-slate-50 px-8 dark:bg-slate-950">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="mb-8 text-center lg:hidden">
            <div className="mb-4 inline-flex rounded-2xl bg-brand-500 p-3">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold gradient-text">TaskFlow</h1>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Welcome back</h2>
            <p className="mt-1 text-sm text-slate-500">Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              leftIcon={<Mail className="h-4 w-4" />}
              error={errors.email?.message}
              {...register('email', { required: 'Email is required' })}
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              leftIcon={<Lock className="h-4 w-4" />}
              error={errors.password?.message}
              {...register('password', { required: 'Password is required' })}
            />

            {/* Remember Me */}
            <label className="flex cursor-pointer items-center gap-2.5">
              <div className="relative flex-shrink-0">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  {...register('rememberMe')}
                />
                <div className="h-4 w-4 rounded border border-slate-300 bg-white transition-colors peer-checked:border-brand-500 peer-checked:bg-brand-500 dark:border-slate-600 dark:bg-slate-800" />
                <svg
                  className="pointer-events-none absolute inset-0 h-4 w-4 scale-0 text-white transition-transform peer-checked:scale-100"
                  fill="none" viewBox="0 0 16 16"
                >
                  <path d="M3.5 8l3 3 5.5-5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="text-sm text-slate-600 dark:text-slate-400">Remember me for 30 days</span>
            </label>

            {/* Inline error banner */}
            {formError && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 dark:border-red-800/50 dark:bg-red-500/10"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
              </motion.div>
            )}

            <Button type="submit" className="w-full" isLoading={isLoading}>
              Sign In
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Don't have an account?{' '}
            <Link to="/register" className="font-medium text-brand-500 hover:text-brand-600">
              Create one
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
};
