/**
 * Canonical contract for the **public v1 REST API** (`/api/v1/*`).
 *
 * This is the single client-side source of truth for the shapes the public API
 * returns — it mirrors the server's `serializeTask` (server/src/utils/
 * serializeTask.ts) and the raw JSON envelopes in publicApi.controller.ts.
 *
 * Why it lives here and isn't physically shared with the server: the two
 * packages deploy independently (separate Render services, each built from its
 * own directory with its own tsconfig `rootDir`), so a cross-package import
 * would break both builds. Keep this file in sync with serializeTask when the
 * task shape changes — it is the contract the /developers docs page documents.
 */

import type { TaskStatus, TaskPriority } from './index';

/** A person reference as returned by the API (populated or bare id). */
export type ApiPerson = { id: string; name?: string; avatar?: string } | string | null;

/** The stable, public Task shape (matches server serializeTask). */
export interface ApiTask {
  id: string;
  identifier: number | null;
  title: string;
  description: string;
  team: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  labels: { name: string; color: string }[];
  assignees: ApiPerson[];
  createdBy: ApiPerson;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  estimatedMinutes: number | null;
  subtasks: { id: string; title: string; completed: boolean }[];
  recurrence: { frequency: string; interval: number; endDate: string | null } | null;
  isArchived: boolean;
  customFields: Record<string, unknown>;
  links: { url: string; label: string; provider: string }[];
  createdAt: string | null;
  updatedAt: string | null;
}

/** GET /v1/tasks — paginated list envelope. */
export interface ApiTaskList {
  data: ApiTask[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

/** Single-resource envelope: GET/POST/PATCH /v1/tasks(/:id). */
export interface ApiTaskResponse {
  data: ApiTask;
}

/** DELETE /v1/tasks/:id. */
export interface ApiDeleteResponse {
  data: { id: string; deleted: true };
}

/** GET /v1/me — token introspection. */
export interface ApiMeResponse {
  team: { id: string; name: string };
  token: { name: string; scopes: ('read' | 'write')[]; lastUsedAt: string | null };
}

/** Stable error codes the v1 API returns (see apiAuth middleware + controllers). */
export type ApiErrorCode =
  | 'API_UNAUTHORIZED'
  | 'API_TOKEN_EXPIRED'
  | 'API_SCOPE_REQUIRED'
  | 'API_RATE_LIMITED'
  | 'PLAN_LIMIT'
  | 'VALIDATION'
  | 'NOT_FOUND';

/** Error envelope returned by the API (via the shared error handler). */
export interface ApiErrorResponse {
  success: false;
  message: string;
  code?: ApiErrorCode;
}
