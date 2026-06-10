import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, Terminal, KeyRound, Gauge, AlertCircle, Boxes } from 'lucide-react';

/* ── Resolve the live API base URL from the build env, with a sensible
 * placeholder so the docs read correctly even on a misconfigured preview. */
const RAW = (import.meta.env.VITE_API_URL as string) || 'https://your-taskflow-server.onrender.com/api';
const API_BASE = `${RAW.replace(/\/$/, '')}/v1`;

// ── Small building blocks ────────────────────────────────────────────────────
const METHOD_STYLES: Record<string, string> = {
  GET: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  POST: 'bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
  PATCH: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
};

const Method = ({ m }: { m: keyof typeof METHOD_STYLES }) => (
  <span className={`inline-block rounded-md px-2 py-0.5 font-mono text-xs font-bold ${METHOD_STYLES[m]}`}>{m}</span>
);

const CodeBlock = ({ code, label }: { code: string; label?: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="group relative my-3 overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
      {label && (
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-1.5">
          <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500">{label}</span>
        </div>
      )}
      <button
        onClick={copy}
        aria-label="Copy code"
        className="absolute right-2 top-2 rounded-lg border border-slate-700 bg-slate-800/80 p-1.5 text-slate-400 opacity-0 transition hover:text-white group-hover:opacity-100"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <pre className="overflow-x-auto px-4 py-3 font-mono text-[13px] leading-relaxed text-slate-100">{code}</pre>
    </div>
  );
};

const Endpoint = ({ method, path, children }: { method: keyof typeof METHOD_STYLES; path: string; children?: React.ReactNode }) => (
  <div className="flex flex-wrap items-center gap-2.5">
    <Method m={method} />
    <code className="font-mono text-[15px] font-semibold text-slate-900 dark:text-slate-100">{path}</code>
    {children}
  </div>
);

const ParamTable = ({ rows }: { rows: [string, string, string][] }) => (
  <div className="my-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="bg-slate-50 dark:bg-slate-900/50">
          <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Field</th>
          <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Type</th>
          <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Description</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([f, t, d]) => (
          <tr key={f} className="border-t border-slate-100 dark:border-slate-800">
            <td className="whitespace-nowrap px-3 py-2 font-mono text-[13px] text-brand-600 dark:text-brand-400">{f}</td>
            <td className="whitespace-nowrap px-3 py-2 font-mono text-[12px] text-slate-500">{t}</td>
            <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{d}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Section = ({ id, icon: Icon, title, children }: { id: string; icon: any; title: string; children: React.ReactNode }) => (
  <section id={id} className="scroll-mt-24 border-t border-slate-200/70 py-10 first:border-0 dark:border-slate-800">
    <h2 className="mb-4 flex items-center gap-2.5 font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
        <Icon className="h-4 w-4" />
      </span>
      {title}
    </h2>
    <div className="prose-sm max-w-none text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">{children}</div>
  </section>
);

const NAV = [
  ['introduction', 'Introduction'],
  ['authentication', 'Authentication'],
  ['rate-limits', 'Rate limits'],
  ['errors', 'Errors'],
  ['task-object', 'The Task object'],
  ['list-tasks', 'List tasks'],
  ['get-task', 'Get a task'],
  ['create-task', 'Create a task'],
  ['update-task', 'Update a task'],
  ['delete-task', 'Delete a task'],
];

export const ApiDocsPage = () => {
  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      {/* Hero */}
      <div className="mb-8">
        <p className="mb-2 font-mono text-xs font-bold uppercase tracking-[0.2em] text-brand-600">Developers</p>
        <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">TaskFlow API</h1>
        <p className="mt-3 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
          A simple, token-authenticated REST API for reading and writing tasks programmatically.
          Build integrations, sync tools, or automate your workflow.
        </p>
        <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 font-mono text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
          <span className="text-slate-400">Base URL</span>
          <span className="select-all font-semibold text-slate-900 dark:text-slate-100">{API_BASE}</span>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[200px_1fr] lg:gap-12">
        {/* Sticky side nav */}
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-1">
            {NAV.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="block rounded-lg px-3 py-1.5 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                {label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div>
          <Section id="introduction" icon={Boxes} title="Introduction">
            <p>
              The TaskFlow API is organised around REST. It uses predictable resource-oriented URLs, accepts and returns
              JSON, and relies on standard HTTP verbs and response codes. Every request is scoped to a single team — the
              team that owns the API token you authenticate with.
            </p>
            <p className="mt-3">
              You can manage tasks: list, read, create, update and delete. All you need to get started is an API token,
              which you can generate in{' '}
              <Link to="/app/settings" className="font-medium text-brand-600 hover:underline">Settings → Developer</Link>.
            </p>
          </Section>

          <Section id="authentication" icon={KeyRound} title="Authentication">
            <p>
              Authenticate by sending your token as a <strong>Bearer token</strong> in the <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[13px] dark:bg-slate-800">Authorization</code> header.
              Tokens start with <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[13px] dark:bg-slate-800">tf_</code> and are shown only once at creation — store them securely and never expose them in client-side code.
            </p>
            <CodeBlock label="cURL" code={`curl ${API_BASE}/me \\\n  -H "Authorization: Bearer tf_your_token_here"`} />
            <p className="mt-3">
              <strong>Scopes.</strong> Each token carries one or more scopes. Read endpoints require the{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[13px] dark:bg-slate-800">read</code> scope; any write
              (create / update / delete) requires the <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[13px] dark:bg-slate-800">write</code> scope.
            </p>
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
              The API is available on the <strong>Pro</strong> and <strong>Business</strong> plans. Requests from a Free team's token return <code className="font-mono">403 PLAN_LIMIT</code>.
            </p>
          </Section>

          <Section id="rate-limits" icon={Gauge} title="Rate limits">
            <p>
              Requests are limited to <strong>120 per minute, per API token</strong>. Every response includes the standard
              rate-limit headers so you can back off gracefully before being throttled:
            </p>
            <ParamTable
              rows={[
                ['RateLimit-Limit', 'header', 'Maximum requests allowed in the current window (120).'],
                ['RateLimit-Remaining', 'header', 'Requests remaining in the current window.'],
                ['RateLimit-Reset', 'header', 'Seconds until the window resets.'],
              ]}
            />
            <p>Exceeding the limit returns <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[13px] dark:bg-slate-800">429</code> with code <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[13px] dark:bg-slate-800">API_RATE_LIMITED</code>.</p>
          </Section>

          <Section id="errors" icon={AlertCircle} title="Errors">
            <p>TaskFlow uses conventional HTTP status codes. Errors return a JSON body with a human-readable <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[13px] dark:bg-slate-800">message</code> and a stable <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[13px] dark:bg-slate-800">code</code>:</p>
            <CodeBlock label="401 Unauthorized" code={`{\n  "success": false,\n  "message": "Invalid or revoked API token.",\n  "code": "API_UNAUTHORIZED"\n}`} />
            <ParamTable
              rows={[
                ['401 · API_UNAUTHORIZED', 'error', 'Missing, malformed, or revoked token.'],
                ['401 · API_TOKEN_EXPIRED', 'error', 'The token has passed its expiry date.'],
                ['403 · API_SCOPE_REQUIRED', 'error', 'The token lacks the required read/write scope.'],
                ['403 · PLAN_LIMIT', 'error', "The token's team is on a plan without API access."],
                ['400 · VALIDATION', 'error', 'The request body failed validation.'],
                ['404 · NOT_FOUND', 'error', 'No task with that id in this team.'],
                ['429 · API_RATE_LIMITED', 'error', 'Rate limit exceeded (120/min).'],
              ]}
            />
          </Section>

          <Section id="task-object" icon={Boxes} title="The Task object">
            <p>Tasks are returned in a stable, public shape (the same schema outbound webhooks use):</p>
            <CodeBlock label="Task" code={`{
  "id": "665f1c...",
  "identifier": 42,
  "title": "Ship the API docs",
  "description": "Public reference for /v1",
  "team": "665abc...",
  "status": "in_progress",
  "priority": "high",
  "labels": [{ "name": "Docs", "color": "#10b981" }],
  "assignees": [{ "id": "665u...", "name": "Ada", "avatar": null }],
  "createdBy": { "id": "665u...", "name": "Ada", "avatar": null },
  "startDate": null,
  "dueDate": "2026-06-15T00:00:00.000Z",
  "completedAt": null,
  "estimatedMinutes": 120,
  "subtasks": [{ "id": "1", "title": "Draft", "completed": true }],
  "recurrence": null,
  "isArchived": false,
  "customFields": {},
  "links": [],
  "createdAt": "2026-06-10T09:00:00.000Z",
  "updatedAt": "2026-06-10T09:30:00.000Z"
}`} />
          </Section>

          <Section id="list-tasks" icon={Terminal} title="List tasks">
            <Endpoint method="GET" path="/v1/tasks" />
            <p className="mt-3">Returns tasks for the token's team, newest first. Supports filtering and pagination via query parameters.</p>
            <ParamTable
              rows={[
                ['status', 'string', 'Filter by todo · in_progress · review · done.'],
                ['priority', 'string', 'Filter by urgent · high · medium · low.'],
                ['assignee', 'string', 'Filter by an assignee user id.'],
                ['search', 'string', 'Full-text search over title & description.'],
                ['includeArchived', 'boolean', 'Set "true" to include archived tasks.'],
                ['page', 'number', 'Page number (default 1).'],
                ['limit', 'number', 'Page size, 1–100 (default 50).'],
              ]}
            />
            <CodeBlock label="Request" code={`curl "${API_BASE}/tasks?status=in_progress&limit=20" \\\n  -H "Authorization: Bearer tf_your_token_here"`} />
            <CodeBlock label="Response · 200" code={`{\n  "data": [ /* Task, … */ ],\n  "pagination": { "page": 1, "limit": 20, "total": 57, "pages": 3 }\n}`} />
          </Section>

          <Section id="get-task" icon={Terminal} title="Get a task">
            <Endpoint method="GET" path="/v1/tasks/:id" />
            <CodeBlock label="Request" code={`curl ${API_BASE}/tasks/665f1c... \\\n  -H "Authorization: Bearer tf_your_token_here"`} />
            <CodeBlock label="Response · 200" code={`{ "data": { /* Task */ } }`} />
          </Section>

          <Section id="create-task" icon={Terminal} title="Create a task">
            <Endpoint method="POST" path="/v1/tasks" />
            <p className="mt-3">Requires the <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[13px] dark:bg-slate-800">write</code> scope. Only <code className="font-mono text-[13px]">title</code> is required.</p>
            <ParamTable
              rows={[
                ['title', 'string · required', '1–200 characters.'],
                ['description', 'string', 'Up to 5000 characters.'],
                ['status', 'string', 'todo · in_progress · review · done (default todo).'],
                ['priority', 'string', 'urgent · high · medium · low (default medium).'],
                ['assignees', 'string[]', 'Array of user ids.'],
                ['labels', 'object[]', '{ name, color } pairs.'],
                ['dueDate', 'string · ISO 8601', 'e.g. "2026-06-15T00:00:00Z", or null.'],
              ]}
            />
            <CodeBlock label="Request" code={`curl -X POST ${API_BASE}/tasks \\\n  -H "Authorization: Bearer tf_your_token_here" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "title": "Review pull request",\n    "priority": "high",\n    "dueDate": "2026-06-15T00:00:00Z"\n  }'`} />
            <CodeBlock label="Response · 201" code={`{ "data": { /* the created Task */ } }`} />
          </Section>

          <Section id="update-task" icon={Terminal} title="Update a task">
            <Endpoint method="PATCH" path="/v1/tasks/:id" />
            <p className="mt-3">Requires the <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[13px] dark:bg-slate-800">write</code> scope. Send only the fields you want to change. Moving a task to <code className="font-mono text-[13px]">done</code> sets its completion timestamp automatically.</p>
            <CodeBlock label="Request" code={`curl -X PATCH ${API_BASE}/tasks/665f1c... \\\n  -H "Authorization: Bearer tf_your_token_here" \\\n  -H "Content-Type: application/json" \\\n  -d '{ "status": "done" }'`} />
            <CodeBlock label="Response · 200" code={`{ "data": { /* the updated Task */ } }`} />
          </Section>

          <Section id="delete-task" icon={Terminal} title="Delete a task">
            <Endpoint method="DELETE" path="/v1/tasks/:id" />
            <p className="mt-3">Requires the <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[13px] dark:bg-slate-800">write</code> scope. Permanently deletes the task.</p>
            <CodeBlock label="Request" code={`curl -X DELETE ${API_BASE}/tasks/665f1c... \\\n  -H "Authorization: Bearer tf_your_token_here"`} />
            <CodeBlock label="Response · 200" code={`{ "data": { "id": "665f1c...", "deleted": true } }`} />
          </Section>

          {/* CTA */}
          <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">Ready to build?</h3>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500">Generate an API token and make your first request in under a minute.</p>
            <Link to="/app/settings" className="mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-ember transition-transform hover:-translate-y-0.5" style={{ background: 'linear-gradient(135deg,#e8502e 0%,#f97316 55%,#fb923c 100%)' }}>
              <KeyRound className="h-4 w-4" /> Get your API token
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
