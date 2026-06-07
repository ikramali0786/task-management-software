import { SlackIntegration, ISlackIntegration } from '../models/SlackIntegration.model';
import { env } from '../config/env';
import logger from '../utils/logger';

/**
 * Slack notifications via per-team Incoming Webhook URLs. Mirrors the outbound
 * webhook service's reliability model (timeout, retries, auto-disable) but emits
 * human-readable Slack Block Kit messages instead of raw JSON.
 */

const TIMEOUT_MS = 8000;
const MAX_ATTEMPTS = 3;
const AUTO_DISABLE_AFTER = 10;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const PRIORITY_EMOJI: Record<string, string> = {
  urgent: '🔴', high: '🟠', medium: '🟡', low: '⚪',
};

const EVENT_META: Record<string, { emoji: string; verb: string }> = {
  'task.created': { emoji: ':sparkles:', verb: 'New task' },
  'task.updated': { emoji: ':pencil2:', verb: 'Task updated' },
  'task.completed': { emoji: ':white_check_mark:', verb: 'Task completed' },
  'task.deleted': { emoji: ':wastebasket:', verb: 'Task deleted' },
  'comment.created': { emoji: ':speech_balloon:', verb: 'New comment' },
  ping: { emoji: ':wave:', verb: 'Test notification' },
};

const clientBase = () => env.CLIENT_URL.replace(/\/$/, '');

const nameOf = (p: any): string | null => {
  if (!p) return null;
  if (typeof p === 'object') return p.name || null;
  return null;
};

/**
 * Build a Slack message ({ text, blocks }) for an event. Pure — exported for tests.
 */
export const buildSlackMessage = (event: string, data: any): { text: string; blocks: any[] } => {
  const meta = EVENT_META[event] || { emoji: ':information_source:', verb: event };

  if (event === 'ping') {
    const text = `${meta.emoji} *TaskFlow test notification* — your Slack integration is working.`;
    return { text, blocks: [{ type: 'section', text: { type: 'mrkdwn', text } }] };
  }

  if (event === 'comment.created') {
    const taskTitle = data?.task?.title ?? 'a task';
    const ident = data?.task?.identifier ? `#${data.task.identifier} ` : '';
    const author = data?.author?.name ? ` by *${data.author.name}*` : '';
    const body = (data?.body ?? '').toString().replace(/<[^>]+>/g, '').slice(0, 280);
    const text = `${meta.emoji} *${meta.verb}*${author} on ${ident}${taskTitle}`;
    const blocks: any[] = [{ type: 'section', text: { type: 'mrkdwn', text } }];
    if (body) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `> ${body}` } });
    return { text, blocks };
  }

  // task.* events — data is the serialized task.
  const ident = data?.identifier ? `#${data.identifier} ` : '';
  const title = data?.title ?? 'Untitled task';
  const text = `${meta.emoji} *${meta.verb}* — ${ident}${title}`;

  const fields: string[] = [];
  if (data?.status) fields.push(`*Status:* ${String(data.status).replace('_', ' ')}`);
  if (data?.priority) fields.push(`*Priority:* ${PRIORITY_EMOJI[data.priority] || ''} ${data.priority}`);
  const assignees = (data?.assignees || []).map(nameOf).filter(Boolean);
  if (assignees.length) fields.push(`*Assignees:* ${assignees.join(', ')}`);
  if (data?.dueDate) fields.push(`*Due:* ${new Date(data.dueDate).toLocaleDateString()}`);

  const blocks: any[] = [{ type: 'section', text: { type: 'mrkdwn', text } }];
  if (fields.length) {
    blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: fields.join('   •   ') }] });
  }
  if (event !== 'task.deleted') {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `<${clientBase()}/kanban|Open in TaskFlow>` }],
    });
  }
  return { text, blocks };
};

interface DeliveryResult {
  ok: boolean;
  status: number;
  error?: string;
}

const postOnce = async (url: string, body: string): Promise<DeliveryResult> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
    });
    return { ok: res.status >= 200 && res.status < 300, status: res.status };
  } catch (err: any) {
    return { ok: false, status: 0, error: err?.name === 'AbortError' ? 'timeout' : err?.message };
  } finally {
    clearTimeout(timer);
  }
};

const deliver = async (integration: ISlackIntegration, event: string, data: unknown): Promise<DeliveryResult> => {
  const body = JSON.stringify(buildSlackMessage(event, data));
  let result: DeliveryResult = { ok: false, status: 0 };
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    result = await postOnce(integration.webhookUrl, body);
    if (result.ok) break;
    if (attempt < MAX_ATTEMPTS) await sleep(attempt * 500);
  }

  const update: Record<string, unknown> = { lastDeliveryAt: new Date(), lastStatus: result.status };
  if (result.ok) {
    update.failureCount = 0;
    update.disabledReason = null;
  } else {
    const failures = (integration.failureCount || 0) + 1;
    update.failureCount = failures;
    if (failures >= AUTO_DISABLE_AFTER) {
      update.enabled = false;
      update.disabledReason = `Auto-disabled after ${failures} consecutive failures.`;
      logger.warn(`[slack] auto-disabled integration for team ${integration.team} after ${failures} failures`);
    }
  }
  await SlackIntegration.findByIdAndUpdate(integration._id, { $set: update });
  return result;
};

const subscribes = (integration: ISlackIntegration, event: string): boolean =>
  integration.events.includes('*') || integration.events.includes(event);

/**
 * Fire-and-forget Slack notification for a team event. Never throws.
 */
export const notifySlack = async (teamId: string, event: string, data: unknown): Promise<void> => {
  try {
    const integration = await SlackIntegration.findOne({ team: teamId, enabled: true });
    if (!integration || !subscribes(integration, event)) return;
    await deliver(integration, event, data);
  } catch (err: any) {
    logger.warn(`[slack] notify failed for team ${teamId} event ${event}: ${err?.message}`);
  }
};

/** Send a test (ping) message to a Slack integration. */
export const sendSlackTest = async (integration: ISlackIntegration): Promise<DeliveryResult> =>
  deliver(integration, 'ping', {});
