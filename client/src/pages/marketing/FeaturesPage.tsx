import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, Kanban, Clock, Repeat, GitBranch, Bot, Sparkles, MessageSquare,
  Zap, Webhook, Slack, KeyRound, ShieldCheck, ScrollText, ListPlus, BarChart2,
  Download, Bell, Users, Globe,
} from 'lucide-react';
import { Eyebrow } from '@/components/marketing/Eyebrow';
import { Reveal, StaggerGroup, StaggerItem } from '@/components/marketing/motion';

const GROUPS = [
  {
    n: '01',
    heading: 'Plan & track',
    tagline: 'From a single task to a full roadmap — with the structure to keep it honest.',
    items: [
      { icon: Kanban, title: 'Kanban & list views', desc: 'Drag-and-drop boards with whole-card dragging, plus a dense list view.' },
      { icon: Clock, title: 'Time tracking & estimates', desc: 'Log time and set estimates to keep projects grounded in reality.' },
      { icon: Repeat, title: 'Recurring tasks', desc: 'Daily, weekly or monthly recurrence with end conditions.' },
      { icon: GitBranch, title: 'Dependencies & subtasks', desc: 'Break work down and surface what’s blocking what.' },
    ],
  },
  {
    n: '02',
    heading: 'AI & automation',
    tagline: 'Let the workspace do the busywork so your team can do the work.',
    items: [
      { icon: Sparkles, title: 'AI quick-add', desc: 'Type “fix login bug tomorrow, urgent” — we structure the task for you.' },
      { icon: Bot, title: 'AI summaries & chatbots', desc: 'Weekly standup digests and custom AI assistants for your team.' },
      { icon: Zap, title: 'Automation rules', desc: 'When a task changes, auto-assign, re-prioritize, label, or comment.' },
      { icon: MessageSquare, title: 'Semantic search', desc: 'Find tasks by meaning with a “?” in the command bar.' },
    ],
  },
  {
    n: '03',
    heading: 'Connect everything',
    tagline: 'Wire TaskFlow into the rest of your stack — or build on top of it.',
    items: [
      { icon: Webhook, title: 'REST API & webhooks', desc: 'A clean v1 API and HMAC-signed webhooks for your own tooling.' },
      { icon: Slack, title: 'Slack notifications', desc: 'Pipe task and comment events straight into your channels.' },
      { icon: ListPlus, title: 'Custom fields', desc: 'Add your own text, number, select, date, and checkbox fields.' },
      { icon: Bell, title: 'Smart notifications', desc: 'In-app and email alerts for assignments, mentions, and due dates.' },
    ],
  },
  {
    n: '04',
    heading: 'Secure & scale',
    tagline: 'The controls and visibility that serious teams expect.',
    items: [
      { icon: KeyRound, title: 'Two-factor auth', desc: 'TOTP with recovery codes to lock down accounts.' },
      { icon: ShieldCheck, title: 'Roles & permissions', desc: 'Built-in and custom roles with server-enforced permissions.' },
      { icon: ScrollText, title: 'Audit log', desc: 'An immutable record of who did what across the workspace.' },
      { icon: BarChart2, title: 'Workload & analytics', desc: 'Balance the team and spot overload before it happens.' },
    ],
  },
  {
    n: '05',
    heading: 'Work anywhere',
    tagline: 'Built for global, distributed teams from day one.',
    items: [
      { icon: Globe, title: 'Timezones & i18n', desc: 'Localized dates, timezones, and right-to-left support.' },
      { icon: Download, title: 'Export your data', desc: 'CSV and PDF exports, plus full account data export anytime.' },
      { icon: Users, title: 'Per-seat teams', desc: 'Invite unlimited members on paid plans; billing scales with seats.' },
    ],
  },
];

export const FeaturesPage = () => (
  <>
    {/* Hero */}
    <section className="mk-grain relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-brand-500/[0.06] to-transparent" />
      <div className="relative z-10 mx-auto max-w-6xl px-5 pb-12 pt-16 md:pt-24">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
          <Eyebrow>The product</Eyebrow>
          <h1 className="mt-4 max-w-3xl font-display text-5xl font-extrabold leading-[1.02] tracking-tight md:text-6xl">
            Everything you need to <span className="mk-underline">ship work</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-slate-600 dark:text-slate-300">
            Planning, collaboration, AI, and enterprise controls — in one fast, real-time workspace.
          </p>
        </motion.div>
      </div>
    </section>

    {/* Capability groups */}
    {GROUPS.map((group) => (
      <section key={group.n} className="border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-6xl gap-10 px-5 py-16 md:grid md:grid-cols-12 md:py-20">
          {/* Sticky group heading */}
          <div className="md:col-span-4 md:sticky md:top-24 md:self-start">
            <Reveal>
              <div className="flex items-baseline gap-3">
                <span className="font-display text-3xl font-extrabold text-slate-200 dark:text-slate-700">{group.n}</span>
                <Eyebrow>{group.heading}</Eyebrow>
              </div>
              <p className="mt-3 max-w-xs font-display text-2xl font-bold leading-snug tracking-tight">{group.tagline}</p>
            </Reveal>
          </div>

          {/* Animated cards */}
          <StaggerGroup className="mt-7 grid gap-4 sm:grid-cols-2 md:col-span-8 md:mt-0">
            {group.items.map((it) => (
              <StaggerItem key={it.title} hover className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-soft transition-shadow hover:shadow-lift dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3 dark:bg-brand-500/10 dark:text-brand-400">
                  <it.icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold">{it.title}</h3>
                <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{it.desc}</p>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>
    ))}

    {/* Closing CTA */}
    <section className="border-t border-slate-200 dark:border-slate-800">
      <Reveal className="mx-auto max-w-6xl px-5 py-20 text-center">
        <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">See it in your own workspace</h2>
        <p className="mx-auto mt-3 max-w-md text-slate-600 dark:text-slate-400">Spin up a team in under a minute — every core feature is free to try.</p>
        <Link to="/register" className="mt-7 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-ember transition-transform hover:-translate-y-0.5" style={{ background: 'linear-gradient(135deg,#e8502e 0%,#f97316 55%,#fb923c 100%)' }}>
          Start for free <ArrowRight className="h-4 w-4" />
        </Link>
      </Reveal>
    </section>
  </>
);
