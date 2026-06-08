export interface HelpArticle {
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  body: string; // markdown
}

export const HELP_CATEGORIES = [
  'Getting started',
  'Tasks & boards',
  'Teams & roles',
  'AI features',
  'Integrations',
  'Billing',
  'Security',
] as const;

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: 'create-your-first-workspace',
    title: 'Create your first workspace',
    category: 'Getting started',
    excerpt: 'Sign up, create a team, and add your first tasks in under a minute.',
    body: `## Create your first workspace

1. **Sign up** with your email and verify it.
2. You'll land on your **dashboard**. Create a team from the sidebar — this is your shared workspace.
3. Open the **Board** and hit **New task** (or press \`N\`) to add work.
4. Invite teammates from **Team** using an email invite or a shareable invite link.

That's it — everyone on the team sees changes in real time.`,
  },
  {
    slug: 'keyboard-shortcuts',
    title: 'Keyboard shortcuts',
    category: 'Getting started',
    excerpt: 'Move faster with the command bar and single-key navigation.',
    body: `## Keyboard shortcuts

- \`Cmd/Ctrl + K\` — open the command bar (search tasks, run commands)
- \`N\` — new task
- In the command bar, type \`>\` for **commands** or \`?\` for **smart (semantic) search**
- \`D\` Dashboard · \`B\` Board · \`L\` Calendar · \`T\` Team · \`W\` Workload · \`A\` Activity · \`S\` Settings`,
  },
  {
    slug: 'using-the-board',
    title: 'Using the Kanban board',
    category: 'Tasks & boards',
    excerpt: 'Drag tasks across columns, filter, and switch to list view.',
    body: `## Using the board

Drag any card between columns to change its status — updates sync instantly for everyone.

- **Filter** by priority, assignee, or due date from the toolbar.
- Switch between **Board** and **List** views.
- **Export** the board to CSV or PDF from the toolbar (Business plans).
- Save frequently-used filters as **views**.`,
  },
  {
    slug: 'recurring-tasks',
    title: 'Recurring tasks',
    category: 'Tasks & boards',
    excerpt: 'Set tasks to repeat daily, weekly, or monthly.',
    body: `## Recurring tasks

Open a task, set its **recurrence** (daily / weekly / monthly with an optional end date). When you complete the task, the next occurrence is created automatically. Recurring tasks are a **Pro** feature.`,
  },
  {
    slug: 'task-templates',
    title: 'Task templates',
    category: 'Tasks & boards',
    excerpt: 'Save repeatable tasks (with subtasks) and spin them up in one click.',
    body: `## Task templates

In the **New task** dialog, choose **Start from a template**, or save the current task as a template with **Save as template**. Templates can include a title, description, priority, status, and a subtask checklist.`,
  },
  {
    slug: 'roles-and-permissions',
    title: 'Roles & permissions',
    category: 'Teams & roles',
    excerpt: 'Control who can edit, delete, and manage your team.',
    body: `## Roles & permissions

Every member has a role: **owner**, **admin**, **moderator**, **member**, or **viewer**. Admins can invite and manage members and edit team settings. On **Pro**, you can define **custom roles** with granular permissions. Permissions are enforced on the server, so they apply to the API too.`,
  },
  {
    slug: 'ai-quick-add-and-summaries',
    title: 'AI quick-add & summaries',
    category: 'AI features',
    excerpt: 'Turn plain English into tasks and get weekly standup digests.',
    body: `## AI features

AI features use your team's **OpenAI API key** (add it in **Team Settings → AI & API**).

- **Quick-add**: in the New task dialog, type something like "fix login bug tomorrow, urgent" and tap **AI fill**.
- **Weekly summary**: on the **Workload** page, generate a standup-style digest of recent activity.
- **Semantic search**: open the command bar and start with \`?\` to find tasks by meaning.`,
  },
  {
    slug: 'automations',
    title: 'Automation rules',
    category: 'AI features',
    excerpt: 'If-this-then-that rules that react to task changes.',
    body: `## Automations

Go to **Settings → Automations** to build rules: choose a trigger (task created / updated / completed), optional conditions (priority, status, title contains, unassigned), and actions (set priority/status, add a label, assign, set a due date, or add a comment). Automations are a **Pro** feature.`,
  },
  {
    slug: 'api-webhooks-slack',
    title: 'API, webhooks & Slack',
    category: 'Integrations',
    excerpt: 'Build on TaskFlow with tokens, signed webhooks, and Slack alerts.',
    body: `## Developer platform

Under **Settings → Developer** (Pro plans) you can:

- Create **API tokens** and call the \`/api/v1\` REST API.
- Add **webhooks** — we POST signed JSON on task & comment events.
- Connect **Slack** to receive notifications in a channel.

See the full reference at \`/API.md\`.`,
  },
  {
    slug: 'two-factor-auth',
    title: 'Two-factor authentication',
    category: 'Security',
    excerpt: 'Add an authenticator-app code to your sign-in.',
    body: `## Two-factor authentication

Go to **Settings → Security → Two-factor authentication** and click **Enable**. Scan the QR code with an authenticator app (Google Authenticator, 1Password, Authy), confirm a code, and save your **recovery codes**. You'll then enter a code each time you sign in.`,
  },
  {
    slug: 'billing-and-plans',
    title: 'Billing & plans',
    category: 'Billing',
    excerpt: 'Upgrade, change seats, and manage your subscription.',
    body: `## Billing & plans

Open **Settings → Billing**. Pick **Pro** or **Business** to start a checkout — billing is **per seat** and adjusts automatically as you add or remove members. Manage or cancel anytime through the customer portal. Changing your team size updates your subscription with prorations.`,
  },
  {
    slug: 'export-your-data',
    title: 'Export your data',
    category: 'Security',
    excerpt: 'Download your tasks and your full account data.',
    body: `## Export your data

- **Tasks**: export a board to **CSV or PDF** from the board toolbar (Business plans).
- **Account**: download everything you've created from **Settings → Security → Export my data**. You can also delete your account there.`,
  },
];

export const findArticle = (slug: string) => HELP_ARTICLES.find((a) => a.slug === slug);
