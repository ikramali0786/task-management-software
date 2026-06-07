import { Request, Response } from 'express';
import { z } from 'zod';
import { AutomationRule, AUTOMATION_TRIGGERS, CONDITION_FIELDS, ACTION_TYPES } from '../models/AutomationRule.model';
import { Team } from '../models/Team.model';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { assertPermission } from '../utils/permissions';
import { assertFeature } from '../utils/teamPlan';

const requireAdminWithAutomations = async (teamId: string, req: Request) => {
  const team = await Team.findById(teamId);
  if (!team) throw new ApiError(404, 'Team not found.');
  assertPermission(team, req.user!._id.toString(), 'manageTeamSettings', 'Only team admins can manage automations.');
  await assertFeature(team, 'automations', req.user!.email);
  return team;
};

const conditionSchema = z.object({
  field: z.enum([...(CONDITION_FIELDS as readonly string[])] as [string, ...string[]]),
  value: z.any(),
});
const actionSchema = z.object({
  type: z.enum([...(ACTION_TYPES as readonly string[])] as [string, ...string[]]),
  value: z.any(),
});
const ruleBody = z.object({
  name: z.string().min(1).max(100),
  trigger: z.enum([...(AUTOMATION_TRIGGERS as readonly string[])] as [string, ...string[]]),
  conditions: z.array(conditionSchema).max(10).optional(),
  actions: z.array(actionSchema).min(1).max(10),
  enabled: z.boolean().optional(),
});

const serialize = (r: any) => ({
  id: r._id.toString(),
  name: r.name,
  enabled: r.enabled,
  trigger: r.trigger,
  conditions: r.conditions,
  actions: r.actions,
  lastRunAt: r.lastRunAt,
  runCount: r.runCount,
  createdAt: r.createdAt,
});

/* GET /automations?teamId=… */
export const listRules = asyncHandler(async (req: Request, res: Response) => {
  const { teamId } = req.query as Record<string, string>;
  if (!teamId) throw new ApiError(400, 'teamId is required.');
  await requireAdminWithAutomations(teamId, req);
  const rules = await AutomationRule.find({ team: teamId }).sort({ createdAt: -1 });
  sendSuccess(res, { rules: rules.map(serialize) });
});

/* POST /automations  body: { teamId, ...rule } */
export const createRule = asyncHandler(async (req: Request, res: Response) => {
  const schema = ruleBody.extend({ teamId: z.string() });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  await requireAdminWithAutomations(parsed.data.teamId, req);

  const rule = await AutomationRule.create({
    team: parsed.data.teamId,
    name: parsed.data.name,
    trigger: parsed.data.trigger,
    conditions: parsed.data.conditions || [],
    actions: parsed.data.actions,
    enabled: parsed.data.enabled ?? true,
    createdBy: req.user!._id,
  });
  sendSuccess(res, { rule: serialize(rule) }, 'Automation created.', 201);
});

/* PATCH /automations/:id */
export const updateRule = asyncHandler(async (req: Request, res: Response) => {
  const parsed = ruleBody.partial().safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const rule = await AutomationRule.findById(req.params.id);
  if (!rule) throw new ApiError(404, 'Automation not found.');
  await requireAdminWithAutomations(rule.team.toString(), req);

  const d = parsed.data;
  if (d.name !== undefined) rule.name = d.name;
  if (d.trigger !== undefined) rule.trigger = d.trigger as any;
  if (d.conditions !== undefined) rule.conditions = d.conditions as any;
  if (d.actions !== undefined) rule.actions = d.actions as any;
  if (d.enabled !== undefined) rule.enabled = d.enabled;
  await rule.save();
  sendSuccess(res, { rule: serialize(rule) }, 'Automation updated.');
});

/* DELETE /automations/:id */
export const deleteRule = asyncHandler(async (req: Request, res: Response) => {
  const rule = await AutomationRule.findById(req.params.id);
  if (!rule) throw new ApiError(404, 'Automation not found.');
  await requireAdminWithAutomations(rule.team.toString(), req);
  await rule.deleteOne();
  sendSuccess(res, null, 'Automation deleted.');
});
