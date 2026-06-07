import { Request, Response } from 'express';
import { z } from 'zod';
import { CustomField, CUSTOM_FIELD_TYPES } from '../models/CustomField.model';
import { Team } from '../models/Team.model';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { sanitizeText } from '../utils/sanitize';
import { assertPermission } from '../utils/permissions';
import { assertFeature } from '../utils/teamPlan';

const memberTeam = async (teamId: string, userId: string) => {
  const team = await Team.findById(teamId);
  if (!team) throw new ApiError(404, 'Team not found.');
  const member = team.members.find((m) => m.user.toString() === userId);
  if (!member) throw new ApiError(403, 'Not a member of this team.');
  return team;
};

const adminWithFeature = async (teamId: string, req: Request) => {
  const team = await memberTeam(teamId, req.user!._id.toString());
  assertPermission(team, req.user!._id.toString(), 'manageTeamSettings', 'Only team admins can manage custom fields.');
  await assertFeature(team, 'customFields', req.user!.email);
  return team;
};

const serialize = (f: any) => ({
  id: f._id.toString(),
  name: f.name,
  type: f.type,
  options: f.options,
  order: f.order,
});

/* GET /custom-fields?teamId=… (any member — needed to render task forms) */
export const listFields = asyncHandler(async (req: Request, res: Response) => {
  const { teamId } = req.query as Record<string, string>;
  if (!teamId) throw new ApiError(400, 'teamId is required.');
  await memberTeam(teamId, req.user!._id.toString());
  const fields = await CustomField.find({ team: teamId }).sort({ order: 1, createdAt: 1 });
  sendSuccess(res, { fields: fields.map(serialize) });
});

/* POST /custom-fields  { teamId, name, type, options? } */
export const createField = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    teamId: z.string(),
    name: z.string().min(1).max(60),
    type: z.enum([...(CUSTOM_FIELD_TYPES as readonly string[])] as [string, ...string[]]),
    options: z.array(z.string().min(1).max(60)).max(30).optional(),
  });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  await adminWithFeature(parsed.data.teamId, req);
  const count = await CustomField.countDocuments({ team: parsed.data.teamId });
  if (count >= 30) throw new ApiError(400, 'A team can have at most 30 custom fields.');

  const field = await CustomField.create({
    team: parsed.data.teamId,
    name: sanitizeText(parsed.data.name),
    type: parsed.data.type,
    options: parsed.data.type === 'select' ? (parsed.data.options || []).map((o) => sanitizeText(o)) : [],
    order: count,
    createdBy: req.user!._id,
  });
  sendSuccess(res, { field: serialize(field) }, 'Custom field created.', 201);
});

/* PATCH /custom-fields/:id  { name?, options? } (type is immutable) */
export const updateField = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    name: z.string().min(1).max(60).optional(),
    options: z.array(z.string().min(1).max(60)).max(30).optional(),
  });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const field = await CustomField.findById(req.params.id);
  if (!field) throw new ApiError(404, 'Field not found.');
  await adminWithFeature(field.team.toString(), req);

  if (parsed.data.name !== undefined) field.name = sanitizeText(parsed.data.name);
  if (parsed.data.options !== undefined && field.type === 'select') {
    field.options = parsed.data.options.map((o) => sanitizeText(o));
  }
  await field.save();
  sendSuccess(res, { field: serialize(field) }, 'Custom field updated.');
});

/* DELETE /custom-fields/:id */
export const deleteField = asyncHandler(async (req: Request, res: Response) => {
  const field = await CustomField.findById(req.params.id);
  if (!field) throw new ApiError(404, 'Field not found.');
  await adminWithFeature(field.team.toString(), req);
  await field.deleteOne();
  // Orphaned values left on tasks are simply ignored by the UI.
  sendSuccess(res, null, 'Custom field deleted.');
});
