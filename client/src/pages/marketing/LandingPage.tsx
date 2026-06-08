import { Link } from 'react-router-dom';
import {
  ArrowRight, Kanban, Zap, Bot, Webhook, ShieldCheck, BarChart2,
  Check, Sparkles, Clock, Users, Repeat, Search,
} from 'lucide-react';
import { PLAN_PRICES } from '@/lib/plans';

const FEATURES = [
  { icon: Kanban, title: 'Kanban that keeps up', desc: 'Drag-and-drop boards with instant, real-time sync across your whole team.' },
  { icon: Bot, title: 'AI built in', desc: 'Quick-add from plain English, weekly standup summaries, and smart search.' },
  { icon: Zap, title: 'Automations', desc: 'If-this-then-that rules: auto-assign, re-prioritize, label, and comment.' },
  { icon: Webhook, title: 'API & webhooks', desc: 'A clean REST API, signed webhooks, and Slack notifications to wire it all together.' },
  { icon: BarChart2, title: 'Workload & insights', desc: 'See who’s overloaded, track time, and keep projects honestly on track.' },
  { icon: ShieldCheck, title: 'Secure by default', desc: 'Two-factor auth, granular roles, audit logs, and a full data export.' },
];

const WHY = [
  { icon: Clock, stat: 'Real-time', label: 'Changes appear instantly for everyone — no refreshing.' },
  { icon: Users, stat: 'Per-seat', label: 'Fair pricing that scales with your team, not your usage.' },
  { icon: Repeat, stat: 'Recurring', label: 'Set tasks to repeat and let them spawn themselves.' },
  { icon: Search, stat: 'Smart search', label: 'Find work by meaning, not just keywords.' },
];

export const LandingPage = () => {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-40 top-40 h-96 w-96 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="mx-auto max-w-6xl px-5 pb-20 pt-20 text-center md:pt-28">
          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/60 px-3 py-1 text-xs font-medium text-brand-700 dark:border-brand-500/30 dark:bg-slate-900/60 dark:text-brand-300">
            <Sparkles className="h-3.5 w-3.5" /> Now with AI quick-add, automations & semantic search
          </div>
          <h1 className="mx-auto max-w-3xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            The task workspace for teams that{' '}
            <span className="gradient-text">move fast</span>.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-slate-600 dark:text-slate-300">
            Plan, track, and ship work together — with real-time boards, built-in AI,
            and the automations and integrations that serious teams need.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/register" className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-ember transition-transform hover:-translate-y-0.5" style={{ background: 'linear-gradient(135deg,#e8502e 0%,#f97316 55%,#fb923c 100%)' }}>
              Start for free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/pricing" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900">
              See pricing
            </Link>
          </div>
          <p className="mt-3 text-xs text-slate-400">Free plan available · no credit card required</p>
        </div>
      </section>

      {/* Feature grid */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight">Everything your team needs in one place</h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">From the first task to enterprise-grade controls.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-6 transition-shadow hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link to="/features" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400">
            Explore all features <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Why band */}
      <section className="border-y border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-5 py-14 lg:grid-cols-4">
          {WHY.map((w) => (
            <div key={w.stat}>
              <w.icon className="mb-3 h-6 w-6 text-brand-500" />
              <p className="text-xl font-bold tracking-tight">{w.stat}</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{w.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Plan teaser */}
      <section className="mx-auto max-w-6xl px-5 py-16 text-center">
        <h2 className="font-display text-3xl font-bold tracking-tight">Simple, per-seat pricing</h2>
        <p className="mx-auto mt-3 max-w-xl text-slate-600 dark:text-slate-400">
          Start free. Upgrade to Pro at ${PLAN_PRICES.pro.monthly}/seat or Business at ${PLAN_PRICES.business.monthly}/seat when you’re ready.
        </p>
        <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-600 dark:text-slate-400">
          {['Unlimited members on paid plans', 'Cancel anytime', 'AI & automations on Pro'].map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-emerald-500" /> {t}</span>
          ))}
        </div>
        <div className="mt-8">
          <Link to="/pricing" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900">
            Compare plans <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="gradient-brand relative overflow-hidden rounded-3xl px-8 py-14 text-center">
          <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <h2 className="font-display text-3xl font-bold tracking-tight text-white">Ready to get your team in flow?</h2>
          <p className="mx-auto mt-3 max-w-md text-white/85">Create your workspace in under a minute — it’s free to start.</p>
          <Link to="/register" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition-transform hover:-translate-y-0.5">
            Start for free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
};
