import crypto from 'crypto';
import { Webhook, IWebhook } from '../models/Webhook.model';
import logger from '../utils/logger';

/**
 * Outbound webhook delivery.
 *
 * Every event becomes a signed JSON POST to each subscribed endpoint. The
 * signature lets integrators verify the payload really came from us:
 *
 *   signature = HMAC_SHA256(secret, rawRequestBody)   // hex
 *
 * sent as `X-TaskFlow-Signature: sha256=<hex>`. Delivery is fire-and-forget
 * with a short timeout and a couple of retries; endpoints that fail repeatedly
 * are auto-disabled so a dead URL can't wedge the queue.
 */

const TIMEOUT_MS = 8000;
const MAX_ATTEMPTS = 3;
const AUTO_DISABLE_AFTER = 10; // consecutive failures

/** Stable HMAC-SHA256 hex signature of a raw payload string. Exported for tests. */
export const signWebhookPayload = (secret: string, payload: string): string =>
  crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');

/** Generate a new sharable webhook signing secret. */
export const generateWebhookSecret = (): string =>
  `whsec_${crypto.randomBytes(24).toString('base64url')}`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface DeliveryResult {
  ok: boolean;
  status: number;       // HTTP status, or 0 on network/timeout error
  error?: string;
}

/** POST a single signed payload to one endpoint, with timeout. No retries. */
const postOnce = async (url: string, secret: string, body: string, event: string, deliveryId: string): Promise<DeliveryResult> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'TaskFlow-Webhooks/1.0',
        'X-TaskFlow-Event': event,
        'X-TaskFlow-Delivery': deliveryId,
        'X-TaskFlow-Signature': `sha256=${signWebhookPayload(secret, body)}`,
      },
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

/** Deliver to one endpoint with retries, then record the outcome on the doc. */
const deliverToEndpoint = async (hook: IWebhook, event: string, payload: string): Promise<DeliveryResult> => {
  const deliveryId = crypto.randomUUID();
  let result: DeliveryResult = { ok: false, status: 0 };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    result = await postOnce(hook.url, hook.secret, payload, event, deliveryId);
    if (result.ok) break;
    if (attempt < MAX_ATTEMPTS) await sleep(attempt * 500); // 0.5s, 1s backoff
  }

  // Record outcome. Use an atomic update so we don't clobber concurrent deliveries.
  const update: Record<string, unknown> = {
    lastDeliveryAt: new Date(),
    lastStatus: result.status,
  };
  if (result.ok) {
    update.failureCount = 0;
    update.disabledReason = null;
    await Webhook.findByIdAndUpdate(hook._id, { $set: update });
  } else {
    const failures = (hook.failureCount || 0) + 1;
    update.failureCount = failures;
    if (failures >= AUTO_DISABLE_AFTER) {
      update.enabled = false;
      update.disabledReason = `Auto-disabled after ${failures} consecutive failures.`;
      logger.warn(`[webhook] auto-disabled ${hook._id} (${hook.url}) after ${failures} failures`);
    }
    await Webhook.findByIdAndUpdate(hook._id, { $set: update });
  }
  return result;
};

/** Does this webhook subscribe to the given event? */
const subscribes = (hook: IWebhook, event: string): boolean =>
  hook.events.includes('*') || hook.events.includes(event);

/**
 * Fire an event to every enabled, subscribed webhook for a team. Fire-and-forget:
 * call as `void dispatchWebhookEvent(...)`. Never throws.
 */
export const dispatchWebhookEvent = async (
  teamId: string,
  event: string,
  data: unknown
): Promise<void> => {
  try {
    const hooks = await Webhook.find({ team: teamId, enabled: true });
    if (!hooks.length) return;

    const relevant = hooks.filter((h) => subscribes(h, event));
    if (!relevant.length) return;

    const payload = JSON.stringify({
      id: crypto.randomUUID(),
      event,
      createdAt: new Date().toISOString(),
      data,
    });

    await Promise.all(relevant.map((h) => deliverToEndpoint(h, event, payload)));
  } catch (err: any) {
    logger.warn(`[webhook] dispatch failed for team ${teamId} event ${event}: ${err?.message}`);
  }
};

/** Send a synthetic `ping` event to a single endpoint (used by the test button). */
export const sendTestDelivery = async (hook: IWebhook): Promise<DeliveryResult> => {
  const payload = JSON.stringify({
    id: crypto.randomUUID(),
    event: 'ping',
    createdAt: new Date().toISOString(),
    data: { message: 'This is a test delivery from TaskFlow.' },
  });
  return deliverToEndpoint(hook, 'ping', payload);
};
