import { Link } from 'react-router-dom';
import {
  ArrowRight, ArrowUpRight, Bot, Zap, Webhook, ShieldCheck, Check,
} from 'lucide-react';
import { PLAN_PRICES } from '@/lib/plans';
import { Eyebrow } from '@/components/marketing/Eyebrow';
import { Reveal, StaggerGroup, StaggerItem } from '@/components/marketing/motion';

/* A stylized faux Kanban board — the hero's memorable element. */
const BoardMock = () => (
  <div className="relative">
    {/* glow */}
    <div className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-brand-500/10 blur-3xl" />
    <div className="relative grid w-[340px] grid-cols-2 gap-3 rounded-2xl border border-slate-200/80 bg-white/80 p-3 shadow-lift backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/80 sm:w-[420px]">
      {/* Column: In progress */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold text-slate-500">In progress</span>
          <span className="font-mono text-[10px] text-slate-400">2</span>
        </div>
        <MockCard title="Ship the v1 API" tag="backend" tagColor="#e8502e" priority="high" done={3} total={4} />
        <MockCard title="Polish the pricing page" tag="design" tagColor="#0d9488" priority="medium" done={1} total={3} />
      </div>
      {/* Column: Review */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold text-slate-500">Review</span>
          <span className="font-mono text-[10px] text-slate-400">1</span>
        </div>
        <MockCard title="Automations: triage rules" tag="ops" tagColor="#f59e0b" priority="urgent" done={2} total={2} />
        <div className="rounded-xl border border-dashed border-slate-200 p-3 text-center text-[11px] text-slate-300 dark:border-slate-700 dark:text-slate-600">
          Drop a task here
        </div>
      </div>
    </div>
    {/* Floating AI chip */}
    <div className="absolute -bottom-4 -left-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lift dark:border-slate-700 dark:bg-slate-900">
      <span className="flex h-6 w-6 items-center justify-center rounded-lg gradient-brand">
        <Bot className="h-3.5 w-3.5 text-white" />
      </span>
      <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200">“Fix login bug tomorrow, urgent”</span>
    </div>
  </div>
);

const PRIORITY_DOT: Record<string, string> = { urgent: '#ef4444', high: '#f97316', medium: '#e8502e', low: '#a89f8f' };

const MockCard = ({ title, tag, tagColor, priority, done, total }: {
  title: string; tag: string; tagColor: string; priority: string; done: number; total: number;
}) => (
  <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-soft dark:border-slate-700 dark:bg-slate-800">
    <div className="mb-2 flex items-center gap-1.5">
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: PRIORITY_DOT[priority] }} />
      <span className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide" style={{ background: `${tagColor}1a`, color: tagColor }}>{tag}</span>
    </div>
    <p className="text-[13px] font-medium leading-snug text-slate-800 dark:text-slate-100">{title}</p>
    <div className="mt-2.5 flex items-center justify-between">
      <div className="flex -space-x-1.5">
        {[0, 1].map((i) => (
          <span key={i} className="h-4 w-4 rounded-full border border-white bg-gradient-to-br from-brand-300 to-brand-500 dark:border-slate-800" />
        ))}
      </div>
      <span className="font-mono text-[10px] text-slate-400">{done}/{total}</span>
    </div>
  </div>
);

/* ── Feature rows (alternating editorial) ───────────────────────────────────── */
const FEATURE_ROWS = [
  {
    n: '01', eyebrow: 'Plan & track', icon: Zap,
    title: 'Real-time boards that keep up with you',
    body: 'Drag-and-drop Kanban, list, and calendar views that sync the instant anyone makes a change. Subtasks, dependencies, time tracking, and recurring work — all built in.',
    points: ['Whole-card drag & instant sync', 'Subtasks, dependencies & estimates', 'Recurring tasks with end dates'],
  },
  {
    n: '02', eyebrow: 'Work smarter', icon: Bot,
    title: 'AI that does the busywork',
    body: 'Turn plain English into structured tasks, get a standup-style digest of the week, and find anything by meaning — not just keywords.',
    points: ['Quick-add from natural language', 'Weekly AI summaries', 'Semantic search'],
  },
  {
    n: '03', eyebrow: 'Connect everything', icon: Webhook,
    title: 'Automations & a real developer platform',
    body: 'If-this-then-that rules react to every change. A clean REST API, signed webhooks, and Slack notifications wire TaskFlow into the rest of your stack.',
    points: ['Automation rules', 'REST API & signed webhooks', 'Slack notifications'],
  },
  {
    n: '04', eyebrow: 'Built for teams', icon: ShieldCheck,
    title: 'Secure, controlled, and ready to scale',
    body: 'Two-factor auth, granular roles, an immutable audit log, custom fields, and full data export — the controls serious teams expect.',
    points: ['2FA & granular roles', 'Audit log & custom fields', 'CSV / PDF & data export'],
  },
];

const MARQUEE = ['Kanban', 'Real-time', 'AI quick-add', 'Automations', 'Webhooks', 'Slack', 'Time tracking', 'Custom fields', 'Audit log', '2FA', 'Semantic search', 'Recurring tasks'];

export const LandingPage = () => {
  return (
    <div className="overflow-hidden">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="mk-grain relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-to-b from-brand-500/[0.07] to-transparent" />
        <div className="pointer-events-none absolute -right-40 top-10 h-[28rem] w-[28rem] rounded-full bg-amber-400/10 blur-3xl" />
        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-16 md:pt-24 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="mk-fade" style={{ animationDelay: '0ms' }}>
              <Eyebrow>Task &amp; project workspace</Eyebrow>
            </div>
            <h1 className="mk-fade mt-5 font-display text-5xl font-extrabold leading-[0.98] tracking-tight md:text-[4.25rem]" style={{ animationDelay: '60ms' }}>
              Where teams<br />
              <span className="mk-underline">turn plans</span><br />
              into progress.
            </h1>
            <p className="mk-fade mt-6 max-w-md text-lg leading-relaxed text-slate-600 dark:text-slate-300" style={{ animationDelay: '140ms' }}>
              Plan, track, and ship work together — real-time boards, built-in AI,
              and the automations serious teams actually need.
            </p>
            <div className="mk-fade mt-8 flex flex-wrap items-center gap-3" style={{ animationDelay: '220ms' }}>
              <Link to="/register" className="group inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-ember transition-transform hover:-translate-y-0.5" style={{ background: 'linear-gradient(135deg,#e8502e 0%,#f97316 55%,#fb923c 100%)' }}>
                Start for free <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link to="/features" className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900">
                Tour the product
              </Link>
            </div>
            <p className="mk-fade mt-4 font-mono text-[11px] uppercase tracking-wider text-slate-400" style={{ animationDelay: '300ms' }}>
              Free plan · no credit card
            </p>
          </div>

          <div className="mk-fade flex justify-center lg:justify-end" style={{ animationDelay: '180ms' }}>
            <BoardMock />
          </div>
        </div>

        {/* Marquee strip */}
        <div className="relative z-10 border-y border-slate-200/70 bg-white/50 py-4 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="flex select-none overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
            <div className="mk-marquee flex shrink-0 items-center gap-8 pr-8">
              {[...MARQUEE, ...MARQUEE].map((w, i) => (
                <span key={i} className="flex items-center gap-8 font-mono text-xs uppercase tracking-wider text-slate-400">
                  {w} <span className="text-brand-400">✦</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature rows ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-20 md:py-28">
        <Reveal className="mb-16 max-w-2xl">
          <Eyebrow>Everything in one place</Eyebrow>
          <h2 className="mt-4 font-display text-4xl font-bold tracking-tight md:text-5xl">
            One workspace, from first task to enterprise.
          </h2>
        </Reveal>

        <div className="space-y-px">
          {FEATURE_ROWS.map((row, i) => (
            <Reveal
              key={row.n}
              className={`grid items-center gap-8 border-t border-slate-200 py-12 dark:border-slate-800 md:grid-cols-12 ${i % 2 === 1 ? 'md:[&>*:first-child]:order-2' : ''}`}
            >
              <div className="md:col-span-5">
                <div className="flex items-center gap-3">
                  <span className="font-display text-3xl font-extrabold text-slate-200 dark:text-slate-700">{row.n}</span>
                  <Eyebrow>{row.eyebrow}</Eyebrow>
                </div>
                <h3 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">{row.title}</h3>
                <p className="mt-3 max-w-md text-slate-600 dark:text-slate-400">{row.body}</p>
                <ul className="mt-5 space-y-2">
                  {row.points.map((p) => (
                    <li key={p} className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                      <Check className="h-4 w-4 flex-shrink-0 text-brand-500" /> {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="md:col-span-7">
                <div className="mk-dots relative flex aspect-[16/9] items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
                  <div className="absolute inset-0 bg-brand-500/[0.04]" />
                  <row.icon className="relative h-16 w-16 text-brand-500/80" strokeWidth={1.25} />
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Stats band ───────────────────────────────────────────────────── */}
      <section className="border-y border-slate-200 bg-slate-900 text-white dark:border-slate-800">
        <StaggerGroup className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-5 py-16 md:grid-cols-4">
          {[
            ['Real-time', 'Instant sync for everyone'],
            ['Per-seat', 'Pricing that scales fairly'],
            ['AI-native', 'Quick-add, summaries, search'],
            ['Secure', '2FA, roles & audit log'],
          ].map(([stat, label]) => (
            <StaggerItem key={stat}>
              <p className="font-display text-3xl font-extrabold tracking-tight gradient-text">{stat}</p>
              <p className="mt-1.5 text-sm text-slate-300">{label}</p>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </section>

      {/* ── Pricing teaser ───────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-20 md:py-28">
        <Reveal className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <Eyebrow>Simple pricing</Eyebrow>
            <h2 className="mt-4 font-display text-4xl font-bold tracking-tight md:text-5xl">
              Start free. Pay per seat<br />when you grow.
            </h2>
            <p className="mt-5 max-w-md text-slate-600 dark:text-slate-400">
              Pro at ${PLAN_PRICES.pro.monthly}/seat unlocks AI, automations and the developer platform.
              Business at ${PLAN_PRICES.business.monthly}/seat adds analytics, audit log and SSO.
            </p>
            <Link to="/pricing" className="mt-7 inline-flex items-center gap-1.5 font-semibold text-brand-600 hover:underline dark:text-brand-400">
              Compare all plans <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-3">
            {[
              ['Free', '$0', 'Up to 5 members, core views'],
              ['Pro', `$${PLAN_PRICES.pro.monthly}`, 'Unlimited members, AI & automations'],
              ['Business', `$${PLAN_PRICES.business.monthly}`, 'Analytics, audit log, SSO'],
            ].map(([name, price, desc], i) => (
              <div key={name} className={`flex items-center justify-between rounded-2xl border p-5 ${i === 1 ? 'border-brand-300 bg-brand-50/50 dark:border-brand-500/40 dark:bg-brand-500/5' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
                <div>
                  <p className="font-semibold">{name}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{desc}</p>
                </div>
                <p className="font-display text-2xl font-extrabold">{price}<span className="text-xs font-normal text-slate-400">{i === 0 ? '' : '/seat'}</span></p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── Closing CTA ──────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <Reveal className="gradient-brand mk-grain relative overflow-hidden rounded-[2rem] px-8 py-16 text-center md:py-20">
          <div className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-10 h-56 w-56 rounded-full bg-black/10 blur-2xl" />
          <h2 className="relative font-display text-4xl font-extrabold tracking-tight text-white md:text-5xl">
            Get your team in flow.
          </h2>
          <p className="relative mx-auto mt-4 max-w-md text-white/85">Create your workspace in under a minute — it’s free to start.</p>
          <Link to="/register" className="relative mt-8 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold text-slate-900 transition-transform hover:-translate-y-0.5">
            Start for free <ArrowRight className="h-4 w-4" />
          </Link>
        </Reveal>
      </section>
    </div>
  );
};
