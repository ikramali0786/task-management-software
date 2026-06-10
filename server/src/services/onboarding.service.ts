import mongoose from 'mongoose';
import { Task, type TaskStatus, type TaskPriority } from '../models/Task.model';
import { Doc } from '../models/Doc.model';
import { Team } from '../models/Team.model';
import logger from '../utils/logger';

/**
 * First-run onboarding seed.
 *
 * A brand-new team is an empty shell — empty board, empty dashboard, empty
 * docs — which is exactly where new users bounce. seedStarterWorkspace drops
 * a small, self-explanatory set of sample tasks (spread across every board
 * column, with priorities/labels/subtasks and one due-soon item so the
 * dashboard + reminders have something to show) plus a "Getting started" wiki
 * page. It's called fire-and-forget on a user's *first* team only and never
 * blocks team creation — any failure is logged and swallowed.
 */

interface SeedTask {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  labels?: { name: string; color: string }[];
  subtasks?: string[];
  /** Days from now for the due date; omit for none. Negative = overdue. */
  dueInDays?: number;
}

// Warm, on-brand label palette (ember + supporting hues from the design system).
const L = {
  onboarding: { name: 'Onboarding', color: '#e8502e' },
  design: { name: 'Design', color: '#8b5cf6' },
  engineering: { name: 'Engineering', color: '#0ea5e9' },
  docs: { name: 'Docs', color: '#10b981' },
};

const SAMPLE_TASKS: SeedTask[] = [
  {
    title: '👋 Welcome to TaskFlow — start here',
    description:
      'This is a sample task. Click any task to open it, leave a comment, add a checklist, attach a file, or assign a teammate.\n\nDrag cards between columns to update their status. When you are ready, delete these samples and add your own work.',
    status: 'todo',
    priority: 'high',
    labels: [L.onboarding],
    subtasks: ['Open this task', 'Try dragging it to "In progress"', 'Mark this subtask done ✅'],
    dueInDays: 1,
  },
  {
    title: 'Invite your team',
    description:
      'Head to the **Team** page to invite teammates by email. Everyone you invite can see this board and collaborate in real time.',
    status: 'todo',
    priority: 'medium',
    labels: [L.onboarding],
  },
  {
    title: 'Plan the Q3 roadmap',
    description: 'An example planning task — break the quarter into themes and assign owners.',
    status: 'todo',
    priority: 'medium',
    labels: [L.design],
    subtasks: ['Draft themes', 'Size the work', 'Review with the team'],
  },
  {
    title: 'Design the new dashboard',
    description: 'A sample task already in progress, so your board and charts have data to show.',
    status: 'in_progress',
    priority: 'high',
    labels: [L.design, L.engineering],
    subtasks: ['Wireframes', 'High-fidelity mockups', 'Handoff to engineering'],
  },
  {
    title: 'Write API documentation',
    description: 'Example task in review — try moving it to Done when you are exploring the board.',
    status: 'review',
    priority: 'low',
    labels: [L.docs],
  },
  {
    title: 'Set up the project',
    description: 'A completed sample task, so your "done this week" stats are not empty on day one.',
    status: 'done',
    priority: 'medium',
    labels: [L.engineering],
  },
];

const WELCOME_DOC = `# Getting started with TaskFlow 🚀

Welcome! This page lives in your team's **Docs** — a built-in wiki for everything that doesn't fit on a task.

## Your sample workspace
We've added a few example tasks to your **Board** so it isn't empty. They show off what tasks can do — checklists, labels, priorities, due dates, comments, and file attachments. Feel free to delete them once you've had a look.

## A few things to try
- **Board** — drag cards between columns to change their status.
- **My Tasks** — see everything assigned to you across all teams.
- **Calendar & Timeline** — view work by due date or as a Gantt-style timeline.
- **Whiteboard** — sketch ideas with your team in real time.
- **Dashboard** — track throughput, due-soon work, and team workload.

## Invite your team
Open the **Team** page to invite people by email. TaskFlow is built for real-time collaboration — changes show up instantly for everyone.

> Tip: press **⌘K** (Ctrl+K) anywhere to search across all your tasks.

Happy organizing!
`;

const DAY_MS = 24 * 60 * 60 * 1000;

export const seedStarterWorkspace = async (
  teamId: string,
  userId: string
): Promise<void> => {
  try {
    const now = Date.now();

    // Assign sequential identifiers in one atomic counter bump, and pack
    // positions per-status using the same 1000-spaced convention as the
    // task controller so the board renders in a sensible order.
    const posByStatus: Record<string, number> = {};
    const docs = SAMPLE_TASKS.map((t, i) => {
      posByStatus[t.status] = (posByStatus[t.status] ?? 0) + 1000;
      return {
        identifier: i + 1,
        title: t.title,
        description: t.description,
        team: new mongoose.Types.ObjectId(teamId),
        createdBy: new mongoose.Types.ObjectId(userId),
        assignees: [new mongoose.Types.ObjectId(userId)],
        status: t.status,
        priority: t.priority,
        labels: t.labels ?? [],
        position: posByStatus[t.status],
        dueDate: t.dueInDays != null ? new Date(now + t.dueInDays * DAY_MS) : null,
        completedAt: t.status === 'done' ? new Date(now - 2 * DAY_MS) : null,
        subtasks: (t.subtasks ?? []).map((title) => ({ title, completed: false })),
      };
    });

    await Task.insertMany(docs);

    // Advance the team's task counter past the seeded identifiers so the next
    // real task gets the correct next number.
    await Team.findByIdAndUpdate(teamId, { $set: { taskCounter: SAMPLE_TASKS.length } });

    // Seed the welcome wiki page.
    await Doc.create({
      team: teamId,
      title: 'Getting started with TaskFlow',
      icon: '🚀',
      content: WELCOME_DOC,
      createdBy: userId,
      updatedBy: userId,
      position: 1000,
    });

    logger.info(`[onboarding] seeded ${SAMPLE_TASKS.length} sample tasks + welcome doc for team ${teamId}`);
  } catch (err: any) {
    // Seeding is best-effort — a new team without samples is fine; a failed
    // team creation is not. Never let this surface to the caller.
    logger.warn(`[onboarding] seed failed for team ${teamId}: ${err?.message}`);
  }
};
