import { Request, Response } from 'express';
import { z } from 'zod';
import { Team } from '../models/Team.model';
import { AccessToken } from '../models/AccessToken.model';
import { Webhook, WEBHOOK_EVENTS } from '../models/Webhook.model';
import { SlackIntegration } from '../models/SlackIntegration.model';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { assertPermission } from '../utils/permissions';
import { assertFeature } from '../utils/teamPlan';
import { generateApiToken } from '../middleware/apiAuth.middleware';
import { generateWebhookSecret, sendTestDelivery } from '../services/webhook.service';
import { sendSlackTest } from '../services/slack.service';

/**
 * Self-serve management of the developer platform (API tokens + webhooks) for a
 * team. All endpoints require team-admin (`manageTeamSettings`) AND the team's
 * effective plan to include `apiAccess` (Pro+ / comp-premium).
 */

/** Load the team, assert the caller is an admin, and assert the plan feature. */
const requireAdminWithApi = async (teamId: string, req: Request) => {
  const team = await Team.findById(teamId);
  if (!team) throw new ApiError(404, 'Team not found.');
  const userId = req.user!._id.toString();
  assertPermission(team, userId, 'manageTeamSettings', 'Only team admins can manage integrations.');
  await assertFeature(team, 'apiAccess', req.user!.email);
  return team;
};

const serializeToken = (t: any) => ({
  id: t._id.toString(),
  name: t.name,
  prefix: t.prefix,
  last4: t.last4,
  scopes: t.scopes,
  lastUsedAt: t.lastUsedAt,
  expiresAt: t.expiresAt,
  createdAt: t.createdAt,
});

const maskSecret = (s: string) => `${s.slice(0, 9)}…${s.slice(-4)}`;

const serializeWebhook = (w: any, revealSecret = false) => ({
  id: w._id.toString(),
  url: w.url,
  events: w.events,
  enabled: w.enabled,
  secret: revealSecret ? w.secret : maskSecret(w.secret),
  lastDeliveryAt: w.lastDeliveryAt,
  lastStatus: w.lastStatus,
  failureCount: w.failureCount,
  disabledReason: w.disabledReason,
  createdAt: w.createdAt,
});

/* ════════════════════════════ API TOKENS ════════════════════════════════ */

// GET /integrations/:teamId/tokens
export const listTokens = asyncHandler(async (req: Request, res: Response) => {
  await requireAdminWithApi(req.params.teamId, req);
  const tokens = await AccessToken.find({ team: req.params.teamId, revoked: false }).sort({ createdAt: -1 });
  sendSuccess(res, { tokens: tokens.map(serializeToken) });
});

// POST /integrations/:teamId/tokens  → returns the plaintext token ONCE
export const createToken = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    name: z.string().min(1).max(100),
    scopes: z.array(z.enum(['read', 'write'])).min(1).optional(),
    expiresInDays: z.number().int().min(1).max(3650).nullable().optional(),
  });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  await requireAdminWithApi(req.params.teamId, req);

  const { token, prefix, last4, hash } = generateApiToken();
  const expiresAt = parsed.data.expiresInDays
    ? new Date(Date.now() + parsed.data.expiresInDays * 86_400_000)
    : null;

  const doc = await AccessToken.create({
    team: req.params.teamId,
    name: parsed.data.name,
    tokenHash: hash,
    prefix,
    last4,
    scopes: parsed.data.scopes || ['read', 'write'],
    createdBy: req.user!._id,
    expiresAt,
  });

  // `token` is returned exactly once — it is never retrievable again.
  sendSuccess(res, { token, apiToken: serializeToken(doc) }, 'API token created. Copy it now — you won’t see it again.', 201);
});

// DELETE /integrations/:teamId/tokens/:id
export const revokeToken = asyncHandler(async (req: Request, res: Response) => {
  await requireAdminWithApi(req.params.teamId, req);
  const tok = await AccessToken.findOneAndUpdate(
    { _id: req.params.id, team: req.params.teamId },
    { $set: { revoked: true } },
    { new: true }
  );
  if (!tok) throw new ApiError(404, 'Token not found.');
  sendSuccess(res, null, 'Token revoked.');
});

/* ════════════════════════════ WEBHOOKS ══════════════════════════════════ */

const urlSchema = z
  .string()
  .url()
  .refine((u) => /^https?:\/\//.test(u), 'URL must start with http:// or https://');

const eventsSchema = z
  .array(z.enum([...(WEBHOOK_EVENTS as readonly string[])] as [string, ...string[]]).or(z.literal('*')))
  .min(1);

// GET /integrations/:teamId/webhooks
export const listWebhooks = asyncHandler(async (req: Request, res: Response) => {
  await requireAdminWithApi(req.params.teamId, req);
  const hooks = await Webhook.find({ team: req.params.teamId }).sort({ createdAt: -1 });
  sendSuccess(res, { webhooks: hooks.map((w) => serializeWebhook(w)) });
});

// POST /integrations/:teamId/webhooks  → returns the secret revealed once
export const createWebhook = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    url: urlSchema,
    events: eventsSchema.optional(),
  });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  await requireAdminWithApi(req.params.teamId, req);

  const hook = await Webhook.create({
    team: req.params.teamId,
    url: parsed.data.url,
    secret: generateWebhookSecret(),
    events: parsed.data.events || ['*'],
    createdBy: req.user!._id,
  });

  sendSuccess(res, { webhook: serializeWebhook(hook, true) }, 'Webhook created.', 201);
});

// PATCH /integrations/:teamId/webhooks/:id
export const updateWebhook = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    url: urlSchema.optional(),
    events: eventsSchema.optional(),
    enabled: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  await requireAdminWithApi(req.params.teamId, req);

  const hook = await Webhook.findOne({ _id: req.params.id, team: req.params.teamId });
  if (!hook) throw new ApiError(404, 'Webhook not found.');

  if (parsed.data.url !== undefined) hook.url = parsed.data.url;
  if (parsed.data.events !== undefined) hook.events = parsed.data.events;
  if (parsed.data.enabled !== undefined) {
    hook.enabled = parsed.data.enabled;
    if (parsed.data.enabled) {
      // Re-enabling clears the failure state.
      hook.failureCount = 0;
      hook.disabledReason = null;
    }
  }
  await hook.save();
  sendSuccess(res, { webhook: serializeWebhook(hook) }, 'Webhook updated.');
});

// DELETE /integrations/:teamId/webhooks/:id
export const deleteWebhook = asyncHandler(async (req: Request, res: Response) => {
  await requireAdminWithApi(req.params.teamId, req);
  const hook = await Webhook.findOneAndDelete({ _id: req.params.id, team: req.params.teamId });
  if (!hook) throw new ApiError(404, 'Webhook not found.');
  sendSuccess(res, null, 'Webhook deleted.');
});

// POST /integrations/:teamId/webhooks/:id/test  → sends a `ping` delivery
export const testWebhook = asyncHandler(async (req: Request, res: Response) => {
  await requireAdminWithApi(req.params.teamId, req);
  const hook = await Webhook.findOne({ _id: req.params.id, team: req.params.teamId });
  if (!hook) throw new ApiError(404, 'Webhook not found.');
  const result = await sendTestDelivery(hook);
  sendSuccess(res, { result }, result.ok ? 'Test delivery succeeded.' : 'Test delivery failed.');
});

/* ════════════════════════════ SLACK ═════════════════════════════════════ */

// Slack incoming webhook URLs look like https://hooks.slack.com/services/T.../B.../xxxx
const slackUrlSchema = z
  .string()
  .url()
  .refine((u) => /^https:\/\/hooks\.slack\.com\/services\//.test(u), 'Enter a valid Slack Incoming Webhook URL.');

// The URL is a secret — never echo it back in full.
const maskUrl = (u: string) => {
  const tail = u.slice(-6);
  return `https://hooks.slack.com/services/…${tail}`;
};

const serializeSlack = (s: any) =>
  s && {
    connected: true,
    urlHint: maskUrl(s.webhookUrl),
    events: s.events,
    enabled: s.enabled,
    lastDeliveryAt: s.lastDeliveryAt,
    lastStatus: s.lastStatus,
    failureCount: s.failureCount,
    disabledReason: s.disabledReason,
    createdAt: s.createdAt,
  };

// GET /integrations/:teamId/slack
export const getSlack = asyncHandler(async (req: Request, res: Response) => {
  await requireAdminWithApi(req.params.teamId, req);
  const slack = await SlackIntegration.findOne({ team: req.params.teamId });
  sendSuccess(res, { slack: slack ? serializeSlack(slack) : { connected: false } });
});

// PUT /integrations/:teamId/slack  → connect or replace the webhook URL
export const connectSlack = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    webhookUrl: slackUrlSchema,
    events: eventsSchema.optional(),
  });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  await requireAdminWithApi(req.params.teamId, req);

  const slack = await SlackIntegration.findOneAndUpdate(
    { team: req.params.teamId },
    {
      $set: {
        webhookUrl: parsed.data.webhookUrl,
        ...(parsed.data.events ? { events: parsed.data.events } : {}),
        enabled: true,
        failureCount: 0,
        disabledReason: null,
        createdBy: req.user!._id,
      },
      $setOnInsert: { team: req.params.teamId },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  sendSuccess(res, { slack: serializeSlack(slack) }, 'Slack connected.');
});

// PATCH /integrations/:teamId/slack  → update events / enabled
export const updateSlack = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    events: eventsSchema.optional(),
    enabled: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  await requireAdminWithApi(req.params.teamId, req);

  const slack = await SlackIntegration.findOne({ team: req.params.teamId });
  if (!slack) throw new ApiError(404, 'Slack is not connected.');

  if (parsed.data.events !== undefined) slack.events = parsed.data.events;
  if (parsed.data.enabled !== undefined) {
    slack.enabled = parsed.data.enabled;
    if (parsed.data.enabled) {
      slack.failureCount = 0;
      slack.disabledReason = null;
    }
  }
  await slack.save();
  sendSuccess(res, { slack: serializeSlack(slack) }, 'Slack updated.');
});

// DELETE /integrations/:teamId/slack
export const disconnectSlack = asyncHandler(async (req: Request, res: Response) => {
  await requireAdminWithApi(req.params.teamId, req);
  await SlackIntegration.findOneAndDelete({ team: req.params.teamId });
  sendSuccess(res, null, 'Slack disconnected.');
});

// POST /integrations/:teamId/slack/test
export const testSlack = asyncHandler(async (req: Request, res: Response) => {
  await requireAdminWithApi(req.params.teamId, req);
  const slack = await SlackIntegration.findOne({ team: req.params.teamId });
  if (!slack) throw new ApiError(404, 'Slack is not connected.');
  const result = await sendSlackTest(slack);
  sendSuccess(res, { result }, result.ok ? 'Test sent to Slack.' : 'Test failed.');
});
