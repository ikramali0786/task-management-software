import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, Lock, AlertCircle, UserX, KeyRound, Eye, EyeOff,
  Zap, SquareKanban, Users, Sparkles,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormData { email: string; password: string; rememberMe: boolean; }
type ErrorField = 'email' | 'password' | 'general';
interface ApiError { message: string; field: ErrorField; }

// ── Left-panel constants ───────────────────────────────────────────────────────

const FEATURES = [
  { icon: SquareKanban, color: 'text-brand-400', glow: 'bg-brand-500/20',   label: 'Visual Kanban Boards',    sub: 'Drag, drop, and ship with clarity' },
  { icon: Zap,          color: 'text-amber-400',  glow: 'bg-amber-500/20',   label: 'Real-time Collaboration', sub: 'Live updates — no refresh needed' },
  { icon: Users,        color: 'text-violet-400', glow: 'bg-violet-500/20',  label: 'Team Management',         sub: 'Roles, permissions, invite codes' },
  { icon: Sparkles,     color: 'text-emerald-400',glow: 'bg-emerald-500/20', label: 'AI Chatbots',             sub: 'OpenAI-powered workflow assistants' },
];

const MOCK_CARDS = [
  {
    status: 'Done',        statusCls: 'bg-emerald-500/20 text-emerald-300', dot: 'bg-emerald-400',
    title: 'Auth flow & JWT token refresh',  meta: 'Completed · 4 members',
    progress: 100, barCls: 'bg-emerald-500',
    rotate: '-2deg', tx: '0px',   ty: '0px',  z: 10, delay: 1.1,
  },
  {
    status: 'In Review',   statusCls: 'bg-amber-500/20 text-amber-300',   dot: 'bg-amber-400',
    title: 'API rate limiting & throttling', meta: 'Sarah · High priority · 2d left',
    progress: 55,  barCls: 'bg-amber-500',
    rotate: '1deg', tx: '20px', ty: '12px', z: 20, delay: 0.8,
  },
  {
    status: 'In Progress', statusCls: 'bg-brand-500/20 text-brand-300',   dot: 'bg-brand-400',
    title: 'Redesign onboarding flow',       meta: '3 subtasks · Due in 2 days',
    progress: 66,  barCls: 'bg-brand-500',
    rotate: '2.5deg', tx: '40px', ty: '22px', z: 30, delay: 0.5,
  },
];

// ── Animated background orb ───────────────────────────────────────────────────

const Orb = ({ cls, anim, dur, delay = 0 }: { cls: string; anim: Record<string, unknown>; dur: number; delay?: number }) => (
  <motion.div
    className={cn('pointer-events-none absolute rounded-full blur-[120px]', cls)}
    animate={anim as any}
    transition={{ duration: dur, delay, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
  />
);

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
    if (lower.includes('account') || lower.includes('email')) return 'email';
    if (lower.includes('password')) return 'password';
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
    <div className="dark">
      <div className="relative flex min-h-screen overflow-hidden bg-[#07080f]">

        {/* ── Animated background orbs ──────────────────────────────────── */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <Orb cls="left-[-12%] top-[-12%] h-[680px] w-[680px] bg-brand-600/[0.18]"
               anim={{ x: [0, 55, 0], y: [0, 40, 0] }} dur={14} />
          <Orb cls="bottom-[-15%] right-[-10%] h-[620px] w-[620px] bg-violet-600/[0.13]"
               anim={{ x: [0, -40, 0], y: [0, -50, 0] }} dur={17} delay={3} />
          <Orb cls="left-[42%] top-[28%] h-[340px] w-[340px] bg-indigo-400/[0.09]"
               anim={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }} dur={9} delay={1.5} />
        </div>

        {/* Subtle dot-grid overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.022]"
          style={{
            backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* ── LEFT PANEL — branding & product preview ───────────────────── */}
        <div className="relative hidden flex-col px-14 py-12 xl:px-20 xl:py-16 lg:flex lg:flex-1">

          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55 }}
            className="flex items-center gap-3"
          >
            <div className="relative">
              <div className="absolute inset-0 scale-150 rounded-xl bg-brand-500/30 blur-xl" />
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 shadow-lg shadow-brand-500/30">
                <Zap className="h-5 w-5 text-white" />
              </div>
            </div>
            <span className="text-xl font-bold tracking-tight text-white">TaskFlow</span>
          </motion.div>

          {/* Headline block */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.65 }}
            className="mt-auto"
          >
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-500/25 bg-brand-500/10 px-3.5 py-1.5 text-xs font-medium text-brand-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-400" />
              Built for modern teams
            </p>

            <h1 className="text-4xl font-extrabold leading-[1.15] tracking-tight text-white xl:text-[2.75rem]">
              Manage your team's
              <br />
              <span className="bg-gradient-to-r from-brand-400 via-violet-400 to-indigo-300 bg-clip-text text-transparent">
                work with clarity.
              </span>
            </h1>
            <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-slate-400">
              Everything your team needs — kanban boards, subtask checklists,
              real-time collaboration, and AI-powered chatbots.
            </p>
          </motion.div>

          {/* Feature grid */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.55 }}
            className="mt-10 grid grid-cols-2 gap-x-6 gap-y-4"
          >
            {FEATURES.map(({ icon: Icon, color, glow, label, sub }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.09, duration: 0.45 }}
                className="flex items-start gap-3"
              >
                <div className={cn('mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg', glow)}>
                  <Icon className={cn('h-4 w-4', color)} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{label}</p>
                  <p className="text-xs leading-relaxed text-slate-500">{sub}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Stacked floating mock task cards */}
          <div className="relative mt-12 h-44 select-none">
            {MOCK_CARDS.map((card, i) => (
              <motion.div
                key={i}
                className="absolute left-0 top-0"
                style={{
                  transform: `translateX(${card.tx}) translateY(${card.ty}) rotate(${card.rotate})`,
                  zIndex: card.z,
                }}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: card.delay, duration: 0.55, type: 'spring', stiffness: 220, damping: 22 }}
              >
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 4 + i * 0.8, repeat: Infinity, ease: 'easeInOut', delay: i * 0.5 }}
                  className="w-64 rounded-2xl border border-white/[0.07] bg-slate-800/75 p-3.5 shadow-2xl backdrop-blur-md"
                >
                  <div className={cn('mb-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold', card.statusCls)}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', card.dot)} />
                    {card.status}
                  </div>
                  <p className="text-sm font-medium leading-snug text-white">{card.title}</p>
                  <p className="mt-1 text-[10px] text-slate-500">{card.meta}</p>
                  <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-slate-700/80">
                    <div className={cn('h-full rounded-full', card.barCls)} style={{ width: `${card.progress}%` }} />
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </div>

          {/* Footer tagline */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 0.6 }}
            className="mt-auto pt-12 text-xs text-slate-700"
          >
            Ship faster. Stay organised. Stay human.
          </motion.p>
        </div>

        {/* ── RIGHT PANEL — login form ──────────────────────────────────── */}
        <div className="relative flex w-full flex-col items-center justify-center px-6 py-12 lg:w-[460px] lg:border-l lg:border-white/[0.04] lg:bg-white/[0.015] lg:backdrop-blur-3xl lg:px-12 lg:py-0">

          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, type: 'spring', stiffness: 220, damping: 24 }}
            className="w-full max-w-sm"
          >
            {/* Mobile logo */}
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <div className="relative">
                <div className="absolute inset-0 scale-150 rounded-xl bg-brand-500/30 blur-lg" />
                <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600">
                  <Zap className="h-4 w-4 text-white" />
                </div>
              </div>
              <span className="text-lg font-bold text-white">TaskFlow</span>
            </div>

            {/* Heading */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white">Welcome back</h2>
              <p className="mt-1.5 text-sm text-slate-400">
                Sign in to continue to your workspace.
              </p>
            </div>

            {/* Form */}
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
                    className="text-slate-500 transition-colors hover:text-slate-300"
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

              {/* Remember me */}
              <label className="flex cursor-pointer items-center gap-2.5">
                <div className="relative flex-shrink-0">
                  <input type="checkbox" className="peer sr-only" {...register('rememberMe')} />
                  <div className="h-4 w-4 rounded border border-slate-600 bg-slate-800/80 transition-all peer-checked:border-brand-500 peer-checked:bg-brand-500" />
                  <svg
                    className="pointer-events-none absolute inset-0 h-4 w-4 scale-0 text-white transition-transform peer-checked:scale-100"
                    fill="none"
                    viewBox="0 0 16 16"
                  >
                    <path d="M3.5 8l3 3 5.5-5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="text-sm text-slate-400">Remember me for 30 days</span>
              </label>

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
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-800 to-transparent" />
              <span className="text-xs text-slate-600">or</span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-800 to-transparent" />
            </div>

            {/* Register link */}
            <p className="text-center text-sm text-slate-500">
              Don&apos;t have an account?{' '}
              <Link
                to="/register"
                className="font-semibold text-brand-400 transition-colors hover:text-brand-300"
              >
                Create one free
              </Link>
            </p>
          </motion.div>
        </div>

      </div>
    </div>
  );
};
