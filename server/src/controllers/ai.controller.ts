import { Request, Response } from 'express';
import { z } from 'zod';
import OpenAI from 'openai';
import { Team } from '../models/Team.model';
import { Task } from '../models/Task.model';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { getDecryptedKey } from './apiKey.controller';
import { consumeAiMessage } from '../utils/teamPlan';

/**
 * AI helpers that reuse the team's stored OpenAI key + monthly AI quota:
 *  • parseTask — natural-language → structured task fields ("quick add")
 *  • summary   — standup-style digest of recent task activity
 */

const AI_MODEL = 'gpt-4o-mini';

const verifyMember = async (teamId: string, userId: string) => {
  const team = await Team.findById(teamId);
  if (!team) throw new ApiError(404, 'Team not found.');
  const member = team.members.find((m) => m.user.toString() === userId);
  if (!member) throw new ApiError(403, 'Not a member of this team.');
  return team;
};

/** Resolve the team's OpenAI client, charging one AI message against quota. */
const aiClientFor = async (team: any, email?: string | null): Promise<OpenAI> => {
  await consumeAiMessage(team, email);
  const key = await getDecryptedKey(team._id.toString());
  if (!key) {
    throw new ApiError(400, 'No OpenAI API key is configured for this team. Add one in Team Settings → AI & API.', {
      code: 'NO_AI_KEY',
    });
  }
  return new OpenAI({ apiKey: key });
};

/* ── POST /ai/parse-task  { teamId, text } ──────────────────────────────────
 * Convert free text like "ship API docs tomorrow 5pm, urgent" into task fields. */
export const parseTask = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({ teamId: z.string(), text: z.string().min(2).max(500) });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const team = await verifyMember(parsed.data.teamId, req.user!._id.toString());
  const openai = await aiClientFor(team, req.user!.email);

  const today = new Date().toISOString();
  const system =
    'You convert a short natural-language note into a single task. ' +
    'Return ONLY a JSON object with these keys: ' +
    'title (string, concise), description (string, optional extra detail or ""), ' +
    "priority ('urgent'|'high'|'medium'|'low'), status ('todo'|'in_progress'|'review'|'done'), " +
    'dueDate (ISO-8601 datetime string or null). ' +
    'Infer priority from urgency words (asap/urgent → urgent). Resolve relative dates ' +
    `(today, tomorrow, "next friday") against the current date. Default status to "todo" and priority to "medium".`;

  let raw = '';
  try {
    const completion = await openai.chat.completions.create(
      {
        model: AI_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `Current date: ${today}\n\nNote: ${parsed.data.text}` },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 400,
      },
      { timeout: 30_000 }
    );
    raw = completion.choices[0]?.message?.content || '';
  } catch (err: any) {
    throw new ApiError(502, `AI error: ${err?.message || 'request failed'}`);
  }

  let json: any = {};
  try { json = JSON.parse(raw); } catch { throw new ApiError(502, 'AI returned an unreadable response.'); }

  const out = z
    .object({
      title: z.string().min(1).max(200),
      description: z.string().max(5000).optional().default(''),
      priority: z.enum(['urgent', 'high', 'medium', 'low']).optional().default('medium'),
      status: z.enum(['todo', 'in_progress', 'review', 'done']).optional().default('todo'),
      dueDate: z.string().datetime().nullable().optional().default(null),
    })
    .safeParse(json);
  if (!out.success) throw new ApiError(502, 'AI could not structure that note. Try rephrasing.');

  sendSuccess(res, { draft: out.data }, 'Parsed.');
});

/* ── POST /ai/summary  { teamId, days? } ────────────────────────────────────
 * Standup-style markdown digest of recent task activity. */
export const summary = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({ teamId: z.string(), days: z.number().int().min(1).max(30).optional() });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const days = parsed.data.days ?? 7;
  const team = await verifyMember(parsed.data.teamId, req.user!._id.toString());

  const since = new Date(Date.now() - days * 86_400_000);
  const tasks = await Task.find({
    team: parsed.data.teamId,
    isArchived: false,
    $or: [{ updatedAt: { $gte: since } }, { dueDate: { $ne: null } }],
  })
    .sort({ updatedAt: -1 })
    .limit(120)
    .populate('assignees', 'name')
    .lean();

  if (tasks.length === 0) {
    return sendSuccess(res, { summary: '_No recent task activity to summarize._' }, 'Summary ready.');
  }

  const openai = await aiClientFor(team, req.user!.email);

  const lines = tasks.map((t: any) => {
    const who = (t.assignees || []).map((a: any) => a.name).filter(Boolean).join(', ') || 'unassigned';
    const due = t.dueDate ? ` due:${new Date(t.dueDate).toISOString().slice(0, 10)}` : '';
    return `#${t.identifier} [${t.status}] (${t.priority}) ${t.title} — ${who}${due}`;
  });

  const system =
    'You are a concise project assistant. Given a list of tasks, write a short standup-style ' +
    'digest in Markdown with these sections (omit any that are empty): ' +
    '**✅ Recently completed**, **🔧 In progress**, **⏰ Due soon / overdue**, **📌 Highlights**. ' +
    'Use compact bullet points referencing task #ids. Keep it under ~180 words.';

  let text = '';
  try {
    const completion = await openai.chat.completions.create(
      {
        model: AI_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `Today: ${new Date().toISOString().slice(0, 10)}\nTasks (last ${days} days):\n${lines.join('\n')}` },
        ],
        temperature: 0.4,
        max_tokens: 600,
      },
      { timeout: 45_000 }
    );
    text = completion.choices[0]?.message?.content || '';
  } catch (err: any) {
    throw new ApiError(502, `AI error: ${err?.message || 'request failed'}`);
  }

  sendSuccess(res, { summary: text || '_No summary generated._' }, 'Summary ready.');
});

/* ── POST /ai/generate-subtasks  { taskId, count? } ─────────────────────────
 * Break a task into a short, actionable subtask checklist. */
export const generateSubtasks = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({ taskId: z.string(), count: z.number().int().min(1).max(12).optional() });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const task = await Task.findById(parsed.data.taskId);
  if (!task) throw new ApiError(404, 'Task not found.');
  const team = await verifyMember(task.team.toString(), req.user!._id.toString());
  const openai = await aiClientFor(team, req.user!.email);

  const count = parsed.data.count ?? 6;
  const system =
    'You break a task down into a short, actionable subtask checklist. ' +
    'Return ONLY a JSON object: { "subtasks": string[] }. ' +
    'Each item is a concise, imperative step (no numbering, no trailing punctuation). ' +
    `Aim for about ${count} items — fewer if the task is simple.`;

  let raw = '';
  try {
    const completion = await openai.chat.completions.create(
      {
        model: AI_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `Task: ${task.title}\n${task.description ? `Details: ${task.description}` : ''}` },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.4,
        max_tokens: 500,
      },
      { timeout: 30_000 }
    );
    raw = completion.choices[0]?.message?.content || '';
  } catch (err: any) {
    throw new ApiError(502, `AI error: ${err?.message || 'request failed'}`);
  }

  let json: any = {};
  try { json = JSON.parse(raw); } catch { throw new ApiError(502, 'AI returned an unreadable response.'); }

  const out = z.object({ subtasks: z.array(z.string().min(1).max(200)).min(1).max(12) }).safeParse(json);
  if (!out.success) throw new ApiError(502, 'AI could not break that task down. Try rephrasing the task.');

  sendSuccess(res, { subtasks: out.data.subtasks.slice(0, count) }, 'Subtasks generated.');
});
