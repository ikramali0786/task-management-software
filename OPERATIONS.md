# TaskFlow — Operations Runbook

How to monitor, protect, and recover the production deployment (Render + MongoDB Atlas).
Companion to [DEPLOYMENT.md](DEPLOYMENT.md).

---

## 1. Error monitoring (Sentry)

Both sides ship with optional Sentry integration that is **off until you set an env var** — no code changes needed.

### Setup (one-time, ~10 minutes)
1. Create a free account at <https://sentry.io> → create **two projects**: one *Node.js (Express)*, one *React*.
2. Copy each project's **DSN**.
3. **Backend** (Render → taskflow-server → Environment): add `SENTRY_DSN=<node DSN>`.
4. **Frontend** (Render → taskflow-client → Environment): add `VITE_SENTRY_DSN=<react DSN>`, then **trigger a redeploy** — `VITE_*` vars are baked at build time.
5. Verify: trigger an error (e.g. hit a route that 500s) and confirm it appears in Sentry within a minute.

### What gets reported
- **Server**: every unexpected 500 (with route, method, user ID tags). Expected traffic — `ApiError`, validation failures, expired JWTs — is *not* reported.
- **Client**: uncaught render errors (via the ErrorBoundary) and unhandled promise rejections. The SDK is lazy-loaded, so builds without a DSN pay zero bundle cost.

### Alerting
In Sentry → **Alerts**, create a rule: "An event is first seen" → email. That's the minimum; add a frequency rule ("more than 10 events in 1 hour") once traffic grows.

---

## 2. Uptime monitoring

The server exposes `GET /health` (rate-limited, returns `{"status":"ok"}`).

1. Create a free account at <https://uptimerobot.com> (or BetterStack).
2. Add an **HTTP(S) monitor** on `https://<your-server>.onrender.com/health`, interval 5 min.
3. Add a second monitor on the frontend URL (expects HTTP 200).
4. Set alert contact to your email.

> Note: free Render services sleep after 15 min idle. The uptime ping every 5 min keeps the **server** awake as a side effect — that's fine and reduces cold starts.

---

## 3. Database backups (MongoDB Atlas)

### Verify backups are on
- **M10+ clusters**: Atlas → Cluster → **Backup** tab → confirm *Cloud Backup* is enabled (continuous + daily snapshots, default retention).
- **Free/Shared (M0/M2/M5)**: ⚠️ **Atlas does NOT back up shared clusters.** Take manual dumps until upgraded:

```bash
# Manual dump (run locally or via cron on any machine)
mongodump --uri "$MONGODB_URI" --archive=taskflow-$(date +%F).gz --gzip
```

Keep at least 7 daily dumps. Store them outside your laptop (e.g. the R2 bucket).

### Restore procedure (test this once!)
1. Spin up a scratch cluster (or local mongod).
2. `mongorestore --uri "<target URI>" --archive=taskflow-YYYY-MM-DD.gz --gzip`
3. Point a local server at the restored DB (`MONGODB_URI` in `server/.env`) and click around.
4. To restore production: restore into the production cluster **with `--drop`** during a maintenance window, then redeploy/restart the server.

A backup you've never restored is a hope, not a backup — do one test restore.

---

## 4. Stripe billing operations

### Webhook health
- Stripe Dashboard → **Developers → Webhooks → \<endpoint\>**: shows delivery attempts and failures. Investigate anything other than 200s.
- Deliveries are **idempotent**: each event ID is recorded in the `processedstripeevents` collection (30-day TTL); replays/retries are ACKed without re-processing. It is therefore always safe to use Stripe's **"Resend"** button on a failed event.

### Dunning (failed renewals)
- `invoice.payment_failed` → team is marked `past_due` (features stay on), owner gets an "update your card" email pointing at Billing settings.
- Stripe retries on its Smart Retries schedule. If a later `invoice.paid` arrives, the team flips back to `active` automatically.
- If all retries fail, Stripe cancels the subscription → `customer.subscription.deleted` → team downgrades to `free`. No manual action needed.

### Manual fixes
- Comp a customer: add their email to `PREMIUM_EMAILS` on the server env (comma-separated) and restart.
- Plan state out of sync with Stripe: resend the latest `customer.subscription.updated` event from the Stripe dashboard — the webhook is the source of truth and overwrites local state.

---

## 5. Rate limits (current configuration)

| Surface | Limit | Keyed by |
|---|---|---|
| All `/api/*` | 500 / 15 min | IP |
| Auth routes | (stricter, see `auth.routes.ts`) | IP |
| AI endpoints (`/api/ai/*`) | 40 / 5 min | user ID |
| Public API (`/api/v1/*`) | 120 / min | API key |
| Public share pages | (see `public.routes.ts`) | IP |
| `/health` | 30 / min | IP |

`RateLimit-*` standard headers are returned on AI and v1 routes so clients can back off before hitting 429s.

---

## 6. CI

`.github/workflows/ci.yml` runs on every push/PR to `main`:
- **Server**: `npm ci` → `tsc --noEmit` → `vitest run`
- **Client**: `npm ci` → `npm run build` (includes type-check)

If CI is red, don't deploy. Render auto-deploys on push, so treat a red CI run as "revert or fix forward immediately."

---

## 7. Incident quick-reference

| Symptom | First checks |
|---|---|
| App down / 502 | Render service status + logs; Atlas cluster status; UptimeRobot history |
| Spike of 500s | Sentry issue feed (grouped by route); recent deploys (`git log`); roll back via Render "Rollback" |
| Users report stale frontend | Confirm Render static site deployed latest commit; hard-refresh (SW is network-first) |
| Billing complaints | Stripe webhook delivery log; team's `plan`/`planStatus` in Atlas; resend latest subscription event |
| OpenAI cost spike | Sentry/logs for AI route volume; rate limit hits (429s); revoke abusive API keys in Settings |
| Suspected data loss | STOP writes if possible; take an immediate `mongodump`; restore per §3 |
