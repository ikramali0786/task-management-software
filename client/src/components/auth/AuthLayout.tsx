import { motion } from 'framer-motion';
import { Zap, SquareKanban, Users, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Shared split-screen shell for the primary auth flows (login + register).
 * Left: branded ember hero with the product pitch. Right: the form panel.
 * Keeping this in one place guarantees both entry points stay perfectly synced.
 */

const FEATURES = [
  { icon: SquareKanban, label: 'Visual Kanban Boards', sub: 'Drag, drop, and ship with clarity' },
  { icon: Zap, label: 'Real-time Collaboration', sub: 'Live updates — no refresh needed' },
  { icon: Users, label: 'Team Management', sub: 'Roles, permissions, invite codes' },
  { icon: Sparkles, label: 'AI Chatbots', sub: 'OpenAI-powered workflow assistants' },
];

const Orb = ({ cls, anim, dur, delay = 0 }: { cls: string; anim: Record<string, unknown>; dur: number; delay?: number }) => (
  <motion.div
    className={cn('pointer-events-none absolute rounded-full blur-[120px]', cls)}
    animate={anim as any}
    transition={{ duration: dur, delay, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
  />
);

interface AuthLayoutProps {
  heading: string;
  subheading: string;
  children: React.ReactNode;
}

export const AuthLayout = ({ heading, subheading, children }: AuthLayoutProps) => (
  <div className="flex min-h-screen">
    {/* ── LEFT PANEL — branding & product preview ───────────────────── */}
    <div className="gradient-brand relative hidden flex-col px-14 py-12 xl:px-20 xl:py-16 lg:flex lg:flex-1 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <Orb cls="left-[-10%] top-[-10%] h-[500px] w-[500px] bg-white/[0.06]" anim={{ x: [0, 40, 0], y: [0, 30, 0] }} dur={14} />
        <Orb cls="bottom-[-15%] right-[-10%] h-[450px] w-[450px] bg-brand-900/[0.25]" anim={{ x: [0, -30, 0], y: [0, -40, 0] }} dur={17} delay={3} />
      </div>

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.55 }}
        className="flex items-center gap-3"
      >
        <div className="relative">
          <div className="absolute inset-0 scale-150 rounded-xl bg-brand-500/30 blur-xl" />
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 shadow-lg shadow-brand-500/30">
            <Zap className="h-5 w-5 text-white" />
          </div>
        </div>
        <span className="text-xl font-bold tracking-tight text-white drop-shadow-sm">TaskFlow</span>
      </motion.div>

      {/* Headline */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.65 }}
        className="mt-auto"
      >
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/70" />
          Built for modern teams
        </p>
        <h1 className="text-4xl font-extrabold leading-[1.15] tracking-tight text-white xl:text-[2.75rem]">
          Manage your team's
          <br />
          <span className="text-white/80">work with clarity.</span>
        </h1>
        <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-white/60">
          Everything your team needs — kanban boards, subtask checklists, real-time collaboration, and AI-powered chatbots.
        </p>
      </motion.div>

      {/* Feature grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.55 }}
        className="mt-10 grid grid-cols-2 gap-x-6 gap-y-4"
      >
        {FEATURES.map(({ icon: Icon, label, sub }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + i * 0.09, duration: 0.45 }}
            className="flex items-start gap-3"
          >
            <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/15">
              <Icon className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{label}</p>
              <p className="text-xs leading-relaxed text-white/55">{sub}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 0.6 }}
        className="mt-auto pt-12 text-xs text-white/40"
      >
        Ship faster. Stay organised. Stay human.
      </motion.p>
    </div>

    {/* ── RIGHT PANEL — form ────────────────────────────────────────── */}
    <div className="relative flex w-full flex-col items-center justify-center bg-slate-50 px-6 py-12 dark:bg-slate-950 lg:w-[460px] lg:px-12 lg:py-0">
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, type: 'spring', stiffness: 220, damping: 24 }}
        className="w-full max-w-sm"
      >
        {/* Mobile logo (hero is hidden on small screens) */}
        <div className="mb-10 flex items-center gap-3 lg:hidden">
          <div className="relative">
            <div className="absolute inset-0 scale-150 rounded-xl bg-brand-500/20 blur-lg" />
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600">
              <Zap className="h-4 w-4 text-white" />
            </div>
          </div>
          <span className="text-lg font-bold text-slate-900 dark:text-slate-100">TaskFlow</span>
        </div>

        {/* Heading */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{heading}</h2>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{subheading}</p>
        </div>

        {children}
      </motion.div>
    </div>
  </div>
);
