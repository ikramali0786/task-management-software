import { dispatchWebhookEvent } from './webhook.service';
import { notifySlack } from './slack.service';
import { runAutomations } from './automation.service';

/**
 * Single entry point for outbound integration events. Fans an event out to
 * outbound webhooks, Slack, and the automation engine. Fire-and-forget — call
 * as a plain statement; the underlying services never throw.
 */
export const deliverIntegrations = (teamId: string, event: string, data: unknown): void => {
  void dispatchWebhookEvent(teamId, event, data);
  void notifySlack(teamId, event, data);
  void runAutomations(teamId, event, data);
};
