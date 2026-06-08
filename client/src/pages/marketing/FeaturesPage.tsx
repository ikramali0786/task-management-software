import { Link } from 'react-router-dom';
import {
  ArrowRight, Kanban, Clock, Repeat, GitBranch, Bot, Sparkles, MessageSquare,
  Zap, Webhook, Slack, KeyRound, ShieldCheck, ScrollText, ListPlus, BarChart2,
  Download, Bell, Users, Globe,
} from 'lucide-react';

const GROUPS = [
  {
    heading: 'Plan & track',
    items: [
      { icon: Kanban, title: 'Kanban & list views', desc: 'Drag-and-drop boards with whole-card dragging, plus a dense list view.' },
      { icon: Clock, title: 'Time tracking & estimates', desc: 'Log time and set estimates to keep projects grounded in reality.' },
      { icon: Repeat, title: 'Recurring tasks', desc: 'Daily, weekly or monthly recurrence with end conditions.' },
      { icon: GitBranch, title: 'Dependencies & subtasks', desc: 'Break work down and surface what’s blocking what.' },
    ],
  },
  {
    heading: 'AI & automation',
    items: [
      { icon: Sparkles, title: 'AI quick-add', desc: 'Type “fix login bug tomorrow, urgent” — we structure the task for you.' },
      { icon: Bot, title: 'AI summaries & chatbots', desc: 'Weekly standup digests and custom AI assistants for your team.' },
      { icon: Zap, title: 'Automation rules', desc: 'When a task changes, auto-assign, re-prioritize, label, or comment.' },
      { icon: MessageSquare, title: 'Semantic search', desc: 'Find tasks by meaning with a “?” in the command bar.' },
    ],
  },
  {
    heading: 'Connect everything',
    items: [
      { icon: Webhook, title: 'REST API & webhooks', desc: 'A clean v1 API and HMAC-signed webhooks for your own tooling.' },
      { icon: Slack, title: 'Slack notifications', desc: 'Pipe task and comment events straight into your channels.' },
      { icon: ListPlus, title: 'Custom fields', desc: 'Add your own text, number, select, date, and checkbox fields.' },
      { icon: Bell, title: 'Smart notifications', desc: 'In-app and email alerts for assignments, mentions, and due dates.' },
    ],
  },
  {
    heading: 'Secure & scale',
    items: [
      { icon: KeyRound, title: 'Two-factor auth', desc: 'TOTP with recovery codes to lock down accounts.' },
      { icon: ShieldCheck, title: 'Roles & permissions', desc: 'Built-in and custom roles with server-enforced permissions.' },
      { icon: ScrollText, title: 'Audit log', desc: 'An immutable record of who did what across the workspace.' },
      { icon: BarChart2, title: 'Workload & analytics', desc: 'Balance the team and spot overload before it happens.' },
    ],
  },
  {
    heading: 'Work anywhere',
    items: [
      { icon: Globe, title: 'Timezones & i18n', desc: 'Localized dates, timezones, and right-to-left support.' },
      { icon: Download, title: 'Export your data', desc: 'CSV and PDF exports, plus full account data export anytime.' },
      { icon: Users, title: 'Per-seat teams', desc: 'Invite unlimited members on paid plans; billing scales with seats.' },
    ],
  },
];

export const FeaturesPage = () => (
  <>
    <section className="mx-auto max-w-6xl px-5 pb-10 pt-16 text-center md:pt-24">
      <h1 className="mx-auto max-w-2xl font-display text-4xl font-extrabold tracking-tight md:text-5xl">
        Everything you need to <span className="gradient-text">ship work</span>
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600 dark:text-slate-300">
        TaskFlow brings planning, collaboration, AI, and enterprise controls into one fast workspace.
      </p>
    </section>

    <section className="mx-auto max-w-6xl space-y-14 px-5 pb-16">
      {GROUPS.map((group) => (
        <div key={group.heading}>
          <h2 className="mb-6 font-display text-2xl font-bold tracking-tight">{group.heading}</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {group.items.map((it) => (
              <div key={it.title} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                  <it.icon className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold">{it.title}</h3>
                <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{it.desc}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>

    <section className="mx-auto max-w-6xl px-5 pb-20 text-center">
      <Link to="/register" className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-ember transition-transform hover:-translate-y-0.5" style={{ background: 'linear-gradient(135deg,#e8502e 0%,#f97316 55%,#fb923c 100%)' }}>
        Start for free <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  </>
);
