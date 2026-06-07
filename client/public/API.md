# TaskFlow REST API & Webhooks

The TaskFlow API lets you read and manage tasks programmatically and receive
real-time webhooks when things change. It's available on the **Pro** and
**Business** plans.

- **Base URL:** `https://<your-server-host>/api/v1`
- **Auth:** `Authorization: Bearer <token>` (create tokens in **Settings → Developer**)
- **Format:** JSON request and response bodies.

All requests are scoped to the team that owns the token.

---

## Authentication

Create a token under **Settings → Developer → API tokens**. The full token
(`tf_…`) is shown **once** — store it securely. Pass it on every request:

```bash
curl https://<host>/api/v1/tasks \
  -H "Authorization: Bearer tf_your_token"
```

Tokens carry scopes:

| Scope   | Grants                                  |
| ------- | --------------------------------------- |
| `read`  | `GET` endpoints                         |
| `write` | `POST`, `PATCH`, `DELETE` endpoints     |

### Error codes

| Status | `code`                | Meaning                                  |
| ------ | --------------------- | ---------------------------------------- |
| 401    | `API_UNAUTHORIZED`    | Missing / invalid / revoked token        |
| 401    | `API_TOKEN_EXPIRED`   | Token passed its expiry                  |
| 403    | `API_SCOPE_REQUIRED`  | Token lacks the required scope           |
| 403    | `PLAN_LIMIT`          | Team's plan doesn't include API access   |
| 404    | `NOT_FOUND`           | Resource not found in this team          |
| 400    | `VALIDATION`          | Invalid request body                     |

---

## Endpoints

### `GET /me`
Introspect the token and its team.

```json
{
  "team": { "id": "…", "name": "Acme" },
  "token": { "name": "CI bot", "scopes": ["read","write"], "lastUsedAt": "…" }
}
```

### `GET /tasks`
List tasks. Query params:

| Param             | Description                                       |
| ----------------- | ------------------------------------------------- |
| `status`          | `todo` \| `in_progress` \| `review` \| `done`     |
| `priority`        | `urgent` \| `high` \| `medium` \| `low`           |
| `assignee`        | user id                                           |
| `search`          | full-text search over title/description           |
| `includeArchived` | `true` to include archived tasks                  |
| `page`, `limit`   | pagination (`limit` max 100, default 50)          |

```json
{
  "data": [ /* Task[] */ ],
  "pagination": { "page": 1, "limit": 50, "total": 134, "pages": 3 }
}
```

### `GET /tasks/:id`
Fetch a single task. → `{ "data": Task }`

### `POST /tasks`  *(scope: write)*
```json
{
  "title": "Ship the API",          // required
  "description": "…",
  "status": "todo",
  "priority": "high",
  "assignees": ["<userId>"],
  "labels": [{ "name": "backend", "color": "#e8502e" }],
  "dueDate": "2026-07-01T00:00:00.000Z"
}
```
→ `201 { "data": Task }`

### `PATCH /tasks/:id`  *(scope: write)*
Send any subset of the create fields. → `{ "data": Task }`

### `DELETE /tasks/:id`  *(scope: write)*
→ `{ "data": { "id": "…", "deleted": true } }`

### Task object

```json
{
  "id": "…",
  "identifier": 42,
  "title": "…",
  "description": "…",
  "team": "…",
  "status": "todo",
  "priority": "medium",
  "labels": [{ "name": "…", "color": "#e8502e" }],
  "assignees": [{ "id": "…", "name": "…", "avatar": "…" }],
  "createdBy": { "id": "…", "name": "…" },
  "dueDate": "…|null",
  "completedAt": "…|null",
  "estimatedMinutes": null,
  "subtasks": [{ "id": "…", "title": "…", "completed": false }],
  "recurrence": { "frequency": "none", "interval": 1, "endDate": null },
  "isArchived": false,
  "createdAt": "…",
  "updatedAt": "…"
}
```

---

## Webhooks

Add an endpoint under **Settings → Developer → Webhooks**. We `POST` a signed
JSON payload whenever a subscribed event fires — whether the change came from the
app or the API.

### Events

| Event             | Fires when…                       |
| ----------------- | --------------------------------- |
| `task.created`    | a task is created                 |
| `task.updated`    | a task is edited                  |
| `task.completed`  | a task moves to `done`            |
| `task.deleted`    | a task is deleted                 |
| `comment.created` | a comment is posted               |

### Payload

```json
{
  "id": "<delivery-uuid>",
  "event": "task.created",
  "createdAt": "2026-06-07T12:00:00.000Z",
  "data": { /* the Task or comment object */ }
}
```

Headers sent with every delivery:

| Header                 | Value                                  |
| ---------------------- | -------------------------------------- |
| `X-TaskFlow-Event`     | the event name (or `ping` for tests)   |
| `X-TaskFlow-Delivery`  | unique delivery id                     |
| `X-TaskFlow-Signature` | `sha256=<hex>` (see below)             |

### Verifying the signature

The signature is the HMAC-SHA256 of the **raw request body** using your
endpoint's signing secret (`whsec_…`, shown once when you create the webhook):

```js
import crypto from 'crypto';

function verify(rawBody, signatureHeader, secret) {
  const expected = 'sha256=' +
    crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
}
```

### Delivery & retries

- Each delivery is attempted up to **3 times** with short backoff.
- Respond with a `2xx` status to acknowledge. Non-2xx / timeouts count as failures.
- After **10 consecutive failures** an endpoint is **auto-disabled**; re-enable it
  from the dashboard (which also resets its failure count).
- Use the **Send test event** button to deliver a `ping` payload on demand.
