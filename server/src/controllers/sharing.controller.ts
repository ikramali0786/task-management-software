import crypto from 'crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import { IntakeForm } from '../models/IntakeForm.model';
import { PublicBoard } from '../models/PublicBoard.model';
import { Team } from '../models/Team.model';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { sanitizeText } from '../utils/sanitize';
import { assertPermission } from '../utils/permissions';

const genToken = () => crypto.randomBytes(9).toString('base64url');

const requireAdmin = async (teamId: string, req: Request) => {
  const team = await Team.findById(teamId);
  if (!team) throw new ApiError(404, 'Team not found.');
  assertPermission(team, req.user!._id.toString(), 'manageTeamSettings', 'Only team admins can manage sharing.');
  return team;
};

const serializeForm = (f: any) => ({
  id: f._id.toString(),
  token: f.token,
  title: f.title,
  intro: f.intro,
  defaultPriority: f.defaultPriority,
  defaultStatus: f.defaultStatus,
  enabled: f.enabled,
  submissionCount: f.submissionCount,
  createdAt: f.createdAt,
});

const formBody = z.object({
  title: z.string().min(1).max(120),
  intro: z.string().max(1000).optional(),
  defaultPriority: z.enum(['urgent', 'high', 'medium', 'low']).optional(),
  defaultStatus: z.enum(['todo', 'in_progress', 'review', 'done']).optional(),
});

/* ════════════════════════════ INTAKE FORMS ══════════════════════════════ */

// GET /sharing/:teamId/forms
export const listForms = asyncHandler(async (req: Request, res: Response) => {
  await requireAdmin(req.params.teamId, req);
  const forms = await IntakeForm.find({ team: req.params.teamId }).sort({ createdAt: -1 });
  sendSuccess(res, { forms: forms.map(serializeForm) });
});

// POST /sharing/:teamId/forms
export const createForm = asyncHandler(async (req: Request, res: Response) => {
  const parsed = formBody.safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);
  await requireAdmin(req.params.teamId, req);

  const form = await IntakeForm.create({
    team: req.params.teamId,
    token: genToken(),
    title: sanitizeText(parsed.data.title),
    intro: sanitizeText(parsed.data.intro || ''),
    defaultPriority: parsed.data.defaultPriority || 'medium',
    defaultStatus: parsed.data.defaultStatus || 'todo',
    createdBy: req.user!._id,
  });
  sendSuccess(res, { form: serializeForm(form) }, 'Form created.', 201);
});

// PATCH /sharing/forms/:id
export const updateForm = asyncHandler(async (req: Request, res: Response) => {
  const parsed = formBody.partial().extend({ enabled: z.boolean().optional() }).safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const form = await IntakeForm.findById(req.params.id);
  if (!form) throw new ApiError(404, 'Form not found.');
  await requireAdmin(form.team.toString(), req);

  const d = parsed.data;
  if (d.title !== undefined) form.title = sanitizeText(d.title);
  if (d.intro !== undefined) form.intro = sanitizeText(d.intro);
  if (d.defaultPriority !== undefined) form.defaultPriority = d.defaultPriority;
  if (d.defaultStatus !== undefined) form.defaultStatus = d.defaultStatus;
  if (d.enabled !== undefined) form.enabled = d.enabled;
  await form.save();
  sendSuccess(res, { form: serializeForm(form) }, 'Form updated.');
});

// DELETE /sharing/forms/:id
export const deleteForm = asyncHandler(async (req: Request, res: Response) => {
  const form = await IntakeForm.findById(req.params.id);
  if (!form) throw new ApiError(404, 'Form not found.');
  await requireAdmin(form.team.toString(), req);
  await form.deleteOne();
  sendSuccess(res, null, 'Form deleted.');
});

/* ════════════════════════════ PUBLIC BOARD ══════════════════════════════ */

const serializeBoard = (b: any) =>
  b ? { enabled: b.enabled, token: b.token } : { enabled: false, token: null };

// GET /sharing/:teamId/board
export const getBoardShare = asyncHandler(async (req: Request, res: Response) => {
  await requireAdmin(req.params.teamId, req);
  const board = await PublicBoard.findOne({ team: req.params.teamId });
  sendSuccess(res, { board: serializeBoard(board) });
});

// POST /sharing/:teamId/board  — enable (create or re-enable; token persists)
export const enableBoardShare = asyncHandler(async (req: Request, res: Response) => {
  await requireAdmin(req.params.teamId, req);
  const board = await PublicBoard.findOneAndUpdate(
    { team: req.params.teamId },
    { $set: { enabled: true }, $setOnInsert: { token: genToken(), createdBy: req.user!._id, team: req.params.teamId } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  sendSuccess(res, { board: serializeBoard(board) }, 'Public board enabled.');
});

// DELETE /sharing/:teamId/board  — disable (keeps token for later re-enable)
export const disableBoardShare = asyncHandler(async (req: Request, res: Response) => {
  await requireAdmin(req.params.teamId, req);
  await PublicBoard.findOneAndUpdate({ team: req.params.teamId }, { $set: { enabled: false } });
  sendSuccess(res, { board: { enabled: false, token: null } }, 'Public board disabled.');
});
