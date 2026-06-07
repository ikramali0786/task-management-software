import { Request, Response } from 'express';
import { z } from 'zod';
import { TaskTemplate } from '../models/TaskTemplate.model';
import { Task, TaskStatus } from '../models/Task.model';
import { Team } from '../models/Team.model';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { sanitizeText } from '../utils/sanitize';
import { assertPermission } from '../utils/permissions';
import { getIO } from '../config/socket';
import { deliverIntegrations } from '../services/integrationEvents.service';
import { serializeTask } from '../utils/serializeTask';

const verifyMember = async (teamId: string, userId: string) => {
  const team = await Team.findById(teamId);
  if (!team) throw new ApiError(404, 'Team not found.');
  const member = team.members.find((m) => m.user.toString() === userId);
  if (!member) throw new ApiError(403, 'Not a member of this team.');
  return team;
};

const labelSchema = z.array(z.object({ name: z.string(), color: z.string() })).optional();
const templateBody = z.object({
  name: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  priority: z.enum(['urgent', 'high', 'medium', 'low']).optional(),
  status: z.enum(['todo', 'in_progress', 'review', 'done']).optional(),
  labels: labelSchema,
  estimatedMinutes: z.number().int().min(0).nullable().optional(),
  subtasks: z.array(z.string().min(1).max(200)).max(50).optional(),
});

const serialize = (t: any) => ({
  id: t._id.toString(),
  name: t.name,
  title: t.title,
  description: t.description,
  priority: t.priority,
  status: t.status,
  labels: t.labels,
  estimatedMinutes: t.estimatedMinutes,
  subtasks: t.subtasks,
  createdAt: t.createdAt,
});

/* GET /templates?teamId=… */
export const listTemplates = asyncHandler(async (req: Request, res: Response) => {
  const { teamId } = req.query as Record<string, string>;
  if (!teamId) throw new ApiError(400, 'teamId is required.');
  await verifyMember(teamId, req.user!._id.toString());
  const templates = await TaskTemplate.find({ team: teamId }).sort({ name: 1 });
  sendSuccess(res, { templates: templates.map(serialize) });
});

/* POST /templates  body: { teamId, ...template } */
export const createTemplate = asyncHandler(async (req: Request, res: Response) => {
  const schema = templateBody.extend({ teamId: z.string() });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const userId = req.user!._id.toString();
  const team = await verifyMember(parsed.data.teamId, userId);
  assertPermission(team, userId, 'createTask', "You don't have permission to manage templates.");

  const d = parsed.data;
  const tpl = await TaskTemplate.create({
    team: d.teamId,
    name: sanitizeText(d.name),
    title: sanitizeText(d.title),
    description: sanitizeText(d.description || ''),
    priority: d.priority || 'medium',
    status: d.status || 'todo',
    labels: d.labels || [],
    estimatedMinutes: d.estimatedMinutes ?? null,
    subtasks: (d.subtasks || []).map((s) => sanitizeText(s)),
    createdBy: userId,
  });
  sendSuccess(res, { template: serialize(tpl) }, 'Template created.', 201);
});

/* PATCH /templates/:id */
export const updateTemplate = asyncHandler(async (req: Request, res: Response) => {
  const parsed = templateBody.partial().safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const tpl = await TaskTemplate.findById(req.params.id);
  if (!tpl) throw new ApiError(404, 'Template not found.');
  const userId = req.user!._id.toString();
  const team = await verifyMember(tpl.team.toString(), userId);
  assertPermission(team, userId, 'createTask', "You don't have permission to manage templates.");

  const d = parsed.data;
  if (d.name !== undefined) tpl.name = sanitizeText(d.name);
  if (d.title !== undefined) tpl.title = sanitizeText(d.title);
  if (d.description !== undefined) tpl.description = sanitizeText(d.description);
  if (d.priority !== undefined) tpl.priority = d.priority;
  if (d.status !== undefined) tpl.status = d.status;
  if (d.labels !== undefined) tpl.labels = d.labels as any;
  if (d.estimatedMinutes !== undefined) tpl.estimatedMinutes = d.estimatedMinutes;
  if (d.subtasks !== undefined) tpl.subtasks = d.subtasks.map((s) => sanitizeText(s));
  await tpl.save();
  sendSuccess(res, { template: serialize(tpl) }, 'Template updated.');
});

/* DELETE /templates/:id */
export const deleteTemplate = asyncHandler(async (req: Request, res: Response) => {
  const tpl = await TaskTemplate.findById(req.params.id);
  if (!tpl) throw new ApiError(404, 'Template not found.');
  const userId = req.user!._id.toString();
  const team = await verifyMember(tpl.team.toString(), userId);
  assertPermission(team, userId, 'createTask', "You don't have permission to manage templates.");
  await tpl.deleteOne();
  sendSuccess(res, null, 'Template deleted.');
});

/* POST /templates/:id/use  body: { status? } → creates a task from the template */
export const useTemplate = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({ status: z.enum(['todo', 'in_progress', 'review', 'done']).optional() });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(400, 'Invalid status.');

  const tpl = await TaskTemplate.findById(req.params.id);
  if (!tpl) throw new ApiError(404, 'Template not found.');
  const userId = req.user!._id.toString();
  const team = await verifyMember(tpl.team.toString(), userId);
  assertPermission(team, userId, 'createTask', "You don't have permission to create tasks.");

  const teamId = tpl.team.toString();
  const status = (parsed.data.status || tpl.status) as TaskStatus;

  const last = await Task.findOne({ team: teamId, status, isArchived: false }).sort({ position: -1 }).select('position');
  const position = last ? last.position + 1000 : 1000;

  const updatedTeam = await Team.findByIdAndUpdate(
    teamId,
    { $inc: { taskCounter: 1 } },
    { new: true, select: 'taskCounter' }
  );
  const identifier = updatedTeam?.taskCounter ?? 1;

  const task = await Task.create({
    identifier,
    title: tpl.title,
    description: tpl.description,
    team: teamId,
    createdBy: userId,
    status,
    priority: tpl.priority,
    labels: tpl.labels,
    estimatedMinutes: tpl.estimatedMinutes,
    subtasks: tpl.subtasks.map((title) => ({ title, completed: false })),
    position,
  });

  const populated = await task.populate([
    { path: 'assignees', select: 'name avatar' },
    { path: 'createdBy', select: 'name avatar' },
  ]);

  const io = getIO();
  if (io) io.to(`team:${teamId}`).emit('task:created', { task: populated });
  deliverIntegrations(teamId, 'task.created', serializeTask(populated));

  sendSuccess(res, { task: populated }, 'Task created from template.', 201);
});
