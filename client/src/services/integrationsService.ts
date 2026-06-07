import api from './api';

export interface ApiToken {
  id: string;
  name: string;
  prefix: string;
  last4: string;
  scopes: ('read' | 'write')[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  secret: string; // masked in list responses, revealed on create
  lastDeliveryAt: string | null;
  lastStatus: number | null;
  failureCount: number;
  disabledReason: string | null;
  createdAt: string;
}

export const integrationsService = {
  // ── API tokens ────────────────────────────────────────────────────────────
  listTokens: async (teamId: string): Promise<ApiToken[]> => {
    const res = await api.get(`/integrations/${teamId}/tokens`);
    return res.data?.data?.tokens ?? [];
  },
  createToken: async (
    teamId: string,
    body: { name: string; scopes?: ('read' | 'write')[]; expiresInDays?: number | null }
  ): Promise<{ token: string; apiToken: ApiToken }> => {
    const res = await api.post(`/integrations/${teamId}/tokens`, body);
    return res.data?.data;
  },
  revokeToken: async (teamId: string, id: string): Promise<void> => {
    await api.delete(`/integrations/${teamId}/tokens/${id}`);
  },

  // ── Webhooks ────────────────────────────────────────────────────────────────
  listWebhooks: async (teamId: string): Promise<WebhookEndpoint[]> => {
    const res = await api.get(`/integrations/${teamId}/webhooks`);
    return res.data?.data?.webhooks ?? [];
  },
  createWebhook: async (
    teamId: string,
    body: { url: string; events?: string[] }
  ): Promise<WebhookEndpoint> => {
    const res = await api.post(`/integrations/${teamId}/webhooks`, body);
    return res.data?.data?.webhook;
  },
  updateWebhook: async (
    teamId: string,
    id: string,
    body: { url?: string; events?: string[]; enabled?: boolean }
  ): Promise<WebhookEndpoint> => {
    const res = await api.patch(`/integrations/${teamId}/webhooks/${id}`, body);
    return res.data?.data?.webhook;
  },
  deleteWebhook: async (teamId: string, id: string): Promise<void> => {
    await api.delete(`/integrations/${teamId}/webhooks/${id}`);
  },
  testWebhook: async (
    teamId: string,
    id: string
  ): Promise<{ ok: boolean; status: number; error?: string }> => {
    const res = await api.post(`/integrations/${teamId}/webhooks/${id}/test`);
    return res.data?.data?.result;
  },
};

/** Webhook event types a user can subscribe to (mirrors the server). */
export const WEBHOOK_EVENT_OPTIONS = [
  { value: 'task.created', label: 'Task created' },
  { value: 'task.updated', label: 'Task updated' },
  { value: 'task.completed', label: 'Task completed' },
  { value: 'task.deleted', label: 'Task deleted' },
  { value: 'comment.created', label: 'Comment created' },
] as const;
