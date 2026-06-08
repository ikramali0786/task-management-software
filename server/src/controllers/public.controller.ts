import { Request, Response } from 'express';
import { z } from 'zod';
import { IntakeForm } from '../models/IntakeForm.model';
import { PublicBoard } from '../models/PublicBoard.model';
import { Task, TaskStatus } from '../models/Task.model';
import { Team } from '../models/Team.model';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { sanitizeText } from '../utils/sanitize';
import { serializeTask } from '../utils/serializeTask';
import { getIO } from '../config/socket';
import { deliverIntegrations } from '../services/integrationEvents.service';

/* ── GET /public/forms/:token ───────────────────────────────────────────────
 * Render data for a public intake form. */
export const getPublicForm = asyncHandler(async (req: Request, res: Response) => {
  const form = await IntakeForm.findOne({ token: req.params.token, enabled: true }).populate('team', 'name');
  if (!form) throw new ApiError(404, 'This form is not available.');
  sendSuccess(res, {
    form: { title: form.title, intro: form.intro, team: (form.team as any)?.name || 'Team' },
  });
});

/* ── POST /public/forms/:token/submit ───────────────────────────────────────
 * Public submission → creates a task in the owning team. */
export const submitPublicForm = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    name: z.string().min(1).max(100),
    email: z.string().email(),
    summary: z.string().min(1).max(200),
    details: z.string().max(5000).optional(),
    company: z.string().optional(), // honeypot
  });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  // Honeypot: bots fill the hidden field — pretend success.
  if (parsed.data.company && parsed.data.company.trim() !== '') {
    return sendSuccess(res, null, 'Thanks — your request has been received.');
  }

  const form = await IntakeForm.findOne({ token: req.params.token, enabled: true });
  if (!form) throw new ApiError(404, 'This form is not available.');

  const teamId = form.team.toString();
  const status = form.defaultStatus as TaskStatus;

  const updatedTeam = await Team.findByIdAndUpdate(
    teamId,
    { $inc: { taskCounter: 1 } },
    { new: true, select: 'taskCounter' }
  );
  const identifier = updatedTeam?.taskCounter ?? 1;
  const last = await Task.findOne({ team: teamId, status, isArchived: false }).sort({ position: -1 }).select('position');
  const position = last ? last.position + 1000 : 1000;

  const description = [
    parsed.data.details ? sanitizeText(parsed.data.details) : '',
    `\n— Submitted via intake form by ${sanitizeText(parsed.data.name)} <${parsed.data.email}>`,
  ].join('').trim();

  const task = await Task.create({
    identifier,
    title: sanitizeText(parsed.data.summary),
    description,
    team: teamId,
    createdBy: form.createdBy,
    status,
    priority: form.defaultPriority,
    labels: [{ name: 'intake', color: '#0d9488' }],
    position,
  });

  form.submissionCount += 1;
  await form.save();

  const populated = await task.populate([
    { path: 'assignees', select: 'name avatar' },
    { path: 'createdBy', select: 'name avatar' },
  ]);
  const io = getIO();
  if (io) io.to(`team:${teamId}`).emit('task:created', { task: populated });
  deliverIntegrations(teamId, 'task.created', serializeTask(populated));

  sendSuccess(res, null, 'Thanks — your request has been received.');
});

/* ── GET /public/boards/:token ──────────────────────────────────────────────
 * Read-only snapshot of a team's board for the public/embed view. */
export const getPublicBoard = asyncHandler(async (req: Request, res: Response) => {
  const board = await PublicBoard.findOne({ token: req.params.token, enabled: true }).populate('team', 'name');
  if (!board) throw new ApiError(404, 'This board is not available.');

  const tasks = await Task.find({ team: board.team, isArchived: false })
    .sort({ status: 1, position: 1 })
    .select('identifier title status priority dueDate assignees')
    .populate('assignees', 'name avatar')
    .limit(500)
    .lean();

  const items = tasks.map((t: any) => ({
    id: t._id.toString(),
    identifier: t.identifier,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate || null,
    assignees: (t.assignees || []).map((a: any) => ({ name: a.name, avatar: a.avatar || null })),
  }));

  sendSuccess(res, { board: { team: (board.team as any)?.name || 'Team', tasks: items } });
});
