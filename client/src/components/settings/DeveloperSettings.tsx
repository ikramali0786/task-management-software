import { useEffect, useState } from 'react';
import {
  Code2, Plus, Copy, Check, Trash2, KeyRound, Webhook as WebhookIcon, Send,
  Loader2, AlertTriangle, Sparkles, ExternalLink, Power, Slack as SlackIcon, Unplug,
} from 'lucide-react';
import { usePlan } from '@/hooks/usePlan';
import { useUIStore } from '@/store/uiStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import {
  integrationsService,
  WEBHOOK_EVENT_OPTIONS,
  type ApiToken,
  type WebhookEndpoint,
  type SlackStatus,
} from '@/services/integrationsService';

const API_BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/v1`;

/* ─── Small copy-to-clipboard button ─────────────────────────────────────── */
const CopyButton = ({ text, label = 'Copy' }: { text: string; label?: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : label}
    </button>
  );
};

/* ─── Upgrade gate ───────────────────────────────────────────────────────── */
const Gate = () => {
  const openUpgrade = useUIStore((s) => s.openUpgrade);
  return (
    <div className="card flex flex-col items-center gap-4 py-12 text-center">
      <div className="gradient-brand inline-flex h-12 w-12 items-center justify-center rounded-xl">
        <Code2 className="h-6 w-6 text-white" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          API & webhooks are a Pro feature
        </h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
          Generate API tokens, build custom integrations, and receive real-time webhooks when tasks
          change. Available on the Pro and Business plans.
        </p>
      </div>
      <Button onClick={() => openUpgrade('apiAccess')} className="gap-2">
        <Sparkles className="h-4 w-4" /> Upgrade to unlock
      </Button>
    </div>
  );
};

/* ─── Status pill for a webhook's last delivery ──────────────────────────── */
const DeliveryPill = ({ hook }: { hook: WebhookEndpoint }) => {
  if (!hook.enabled) {
    return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">Disabled</span>;
  }
  if (hook.lastStatus == null) {
    return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">No deliveries</span>;
  }
  const ok = hook.lastStatus >= 200 && hook.lastStatus < 300;
  return (
    <span className={cn(
      'rounded-full px-2 py-0.5 text-[11px] font-medium',
      ok ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
         : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'
    )}>
      {ok ? 'Healthy' : `Failing · ${hook.lastStatus || 'network'}`}
    </span>
  );
};

export const DeveloperSettings = () => {
  const { can, team } = usePlan();
  const { addToast, showConfirm } = useUIStore();
  const teamId = team?._id;

  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [hooks, setHooks] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);

  // Token creation
  const [newTokenName, setNewTokenName] = useState('');
  const [newTokenWrite, setNewTokenWrite] = useState(true);
  const [creatingToken, setCreatingToken] = useState(false);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);

  // Webhook creation
  const [newHookUrl, setNewHookUrl] = useState('');
  const [newHookEvents, setNewHookEvents] = useState<string[]>(WEBHOOK_EVENT_OPTIONS.map((e) => e.value));
  const [creatingHook, setCreatingHook] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<{ id: string; secret: string } | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Slack
  const [slack, setSlack] = useState<SlackStatus>({ connected: false });
  const [slackUrl, setSlackUrl] = useState('');
  const [slackEvents, setSlackEvents] = useState<string[]>(WEBHOOK_EVENT_OPTIONS.map((e) => e.value));
  const [slackBusy, setSlackBusy] = useState(false);
  const [testingSlack, setTestingSlack] = useState(false);

  const hasApi = can('apiAccess');

  useEffect(() => {
    if (!teamId || !hasApi) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    Promise.all([
      integrationsService.listTokens(teamId),
      integrationsService.listWebhooks(teamId),
      integrationsService.getSlack(teamId),
    ])
      .then(([t, w, s]) => {
        if (!active) return;
        setTokens(t); setHooks(w); setSlack(s);
        if (s.connected && s.events) setSlackEvents(s.events.includes('*') ? WEBHOOK_EVENT_OPTIONS.map((e) => e.value) : s.events);
      })
      .catch(() => { if (active) addToast({ type: 'error', title: 'Failed to load integrations' }); })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [teamId, hasApi]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!team) {
    return <div className="card text-sm text-slate-500 dark:text-slate-400">Select a team to manage its API tokens and webhooks.</div>;
  }
  if (!hasApi) return <Gate />;

  /* ── Token actions ─────────────────────────────────────── */
  const createToken = async () => {
    if (!teamId || !newTokenName.trim()) return;
    setCreatingToken(true);
    try {
      const { token, apiToken } = await integrationsService.createToken(teamId, {
        name: newTokenName.trim(),
        scopes: newTokenWrite ? ['read', 'write'] : ['read'],
      });
      setTokens((prev) => [apiToken, ...prev]);
      setRevealedToken(token);
      setNewTokenName('');
      addToast({ type: 'success', title: 'API token created' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Could not create token', message: err?.response?.data?.message });
    } finally {
      setCreatingToken(false);
    }
  };

  const revokeToken = async (tok: ApiToken) => {
    if (!teamId) return;
    const ok = await showConfirm({
      title: 'Revoke this token?',
      message: `Any integration using “${tok.name}” will immediately stop working. This cannot be undone.`,
      confirmLabel: 'Revoke',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await integrationsService.revokeToken(teamId, tok.id);
      setTokens((prev) => prev.filter((t) => t.id !== tok.id));
      addToast({ type: 'success', title: 'Token revoked' });
    } catch {
      addToast({ type: 'error', title: 'Could not revoke token' });
    }
  };

  /* ── Webhook actions ───────────────────────────────────── */
  const toggleEvent = (value: string) =>
    setNewHookEvents((prev) => (prev.includes(value) ? prev.filter((e) => e !== value) : [...prev, value]));

  const createHook = async () => {
    if (!teamId || !newHookUrl.trim() || newHookEvents.length === 0) return;
    setCreatingHook(true);
    try {
      const hook = await integrationsService.createWebhook(teamId, {
        url: newHookUrl.trim(),
        events: newHookEvents,
      });
      setHooks((prev) => [hook, ...prev]);
      setRevealedSecret({ id: hook.id, secret: hook.secret });
      setNewHookUrl('');
      addToast({ type: 'success', title: 'Webhook added' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Could not add webhook', message: err?.response?.data?.message });
    } finally {
      setCreatingHook(false);
    }
  };

  const toggleHook = async (hook: WebhookEndpoint) => {
    if (!teamId) return;
    try {
      const updated = await integrationsService.updateWebhook(teamId, hook.id, { enabled: !hook.enabled });
      setHooks((prev) => prev.map((h) => (h.id === hook.id ? updated : h)));
    } catch {
      addToast({ type: 'error', title: 'Could not update webhook' });
    }
  };

  const testHook = async (hook: WebhookEndpoint) => {
    if (!teamId) return;
    setTestingId(hook.id);
    try {
      const result = await integrationsService.testWebhook(teamId, hook.id);
      addToast({
        type: result.ok ? 'success' : 'error',
        title: result.ok ? 'Test delivered' : 'Test failed',
        message: result.ok ? `Endpoint responded ${result.status}.` : result.error || `Status ${result.status}.`,
      });
      // Refresh status badge.
      const fresh = await integrationsService.listWebhooks(teamId);
      setHooks(fresh);
    } catch {
      addToast({ type: 'error', title: 'Test failed' });
    } finally {
      setTestingId(null);
    }
  };

  const deleteHook = async (hook: WebhookEndpoint) => {
    if (!teamId) return;
    const ok = await showConfirm({
      title: 'Delete this webhook?',
      message: 'You will stop receiving events at this endpoint.',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await integrationsService.deleteWebhook(teamId, hook.id);
      setHooks((prev) => prev.filter((h) => h.id !== hook.id));
      addToast({ type: 'success', title: 'Webhook deleted' });
    } catch {
      addToast({ type: 'error', title: 'Could not delete webhook' });
    }
  };

  /* ── Slack actions ─────────────────────────────────────── */
  const toggleSlackEvent = (value: string) =>
    setSlackEvents((prev) => (prev.includes(value) ? prev.filter((e) => e !== value) : [...prev, value]));

  const connectSlack = async () => {
    if (!teamId || !slackUrl.trim() || slackEvents.length === 0) return;
    setSlackBusy(true);
    try {
      const s = await integrationsService.connectSlack(teamId, { webhookUrl: slackUrl.trim(), events: slackEvents });
      setSlack(s);
      setSlackUrl('');
      addToast({ type: 'success', title: 'Slack connected' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Could not connect Slack', message: err?.response?.data?.message });
    } finally {
      setSlackBusy(false);
    }
  };

  const toggleSlackEnabled = async () => {
    if (!teamId) return;
    try {
      const s = await integrationsService.updateSlack(teamId, { enabled: !slack.enabled });
      setSlack(s);
    } catch {
      addToast({ type: 'error', title: 'Could not update Slack' });
    }
  };

  const saveSlackEvents = async () => {
    if (!teamId || slackEvents.length === 0) return;
    setSlackBusy(true);
    try {
      const s = await integrationsService.updateSlack(teamId, { events: slackEvents });
      setSlack(s);
      addToast({ type: 'success', title: 'Slack events updated' });
    } catch {
      addToast({ type: 'error', title: 'Could not update Slack' });
    } finally {
      setSlackBusy(false);
    }
  };

  const testSlackNow = async () => {
    if (!teamId) return;
    setTestingSlack(true);
    try {
      const result = await integrationsService.testSlack(teamId);
      addToast({
        type: result.ok ? 'success' : 'error',
        title: result.ok ? 'Test sent to Slack' : 'Test failed',
        message: result.ok ? 'Check your Slack channel.' : result.error || `Status ${result.status}.`,
      });
      setSlack(await integrationsService.getSlack(teamId));
    } catch {
      addToast({ type: 'error', title: 'Test failed' });
    } finally {
      setTestingSlack(false);
    }
  };

  const disconnectSlack = async () => {
    if (!teamId) return;
    const ok = await showConfirm({
      title: 'Disconnect Slack?',
      message: 'TaskFlow will stop posting notifications to your Slack channel.',
      confirmLabel: 'Disconnect',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await integrationsService.disconnectSlack(teamId);
      setSlack({ connected: false });
      setSlackEvents(WEBHOOK_EVENT_OPTIONS.map((e) => e.value));
      addToast({ type: 'success', title: 'Slack disconnected' });
    } catch {
      addToast({ type: 'error', title: 'Could not disconnect Slack' });
    }
  };

  return (
    <div className="space-y-5">
      {/* ── Base URL / quick start ─────────────────────────── */}
      <div className="card">
        <div className="mb-1 flex items-center gap-2">
          <Code2 className="h-4 w-4 text-brand-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">REST API</h3>
        </div>
        <p className="mb-4 text-xs text-slate-400">
          Build on top of TaskFlow. Authenticate with a token below and call the v1 API.
        </p>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/60">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Base URL</span>
            <CopyButton text={API_BASE} />
          </div>
          <code className="block break-all font-mono text-xs text-slate-700 dark:text-slate-300">{API_BASE}</code>
          <div className="mt-3 rounded-lg bg-slate-900 p-3 dark:bg-black/40">
            <code className="block whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-slate-200">
{`curl ${API_BASE}/tasks \\
  -H "Authorization: Bearer tf_your_token"`}
            </code>
          </div>
        </div>
      </div>

      {/* ── API Tokens ─────────────────────────────────────── */}
      <div className="card">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-brand-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">API tokens</h3>
        </div>

        {/* Reveal banner */}
        {revealedToken && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" /> Copy your token now — you won’t see it again
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded-lg bg-white px-2.5 py-1.5 font-mono text-xs text-slate-800 dark:bg-slate-900 dark:text-slate-200">{revealedToken}</code>
              <CopyButton text={revealedToken} />
              <button onClick={() => setRevealedToken(null)} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">Done</button>
            </div>
          </div>
        )}

        {/* Create */}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={newTokenName}
            onChange={(e) => setNewTokenName(e.target.value)}
            placeholder="Token name (e.g. Zapier, CI bot)"
            className="flex-1"
          />
          <label className="flex items-center gap-2 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
            <input
              type="checkbox"
              checked={newTokenWrite}
              onChange={(e) => setNewTokenWrite(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
            />
            Write access
          </label>
          <Button onClick={createToken} disabled={creatingToken || !newTokenName.trim()} className="gap-1.5">
            {creatingToken ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create
          </Button>
        </div>

        {/* List */}
        {loading ? (
          <div className="py-6 text-center text-sm text-slate-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
        ) : tokens.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">No tokens yet.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {tokens.map((tok) => (
              <div key={tok.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{tok.name}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      {tok.scopes.includes('write') ? 'read · write' : 'read'}
                    </span>
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-slate-400">
                    {tok.prefix}…{tok.last4}
                    <span className="ml-2">· {tok.lastUsedAt ? `last used ${new Date(tok.lastUsedAt).toLocaleDateString()}` : 'never used'}</span>
                  </p>
                </div>
                <button
                  onClick={() => revokeToken(tok)}
                  className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                  aria-label="Revoke token"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Webhooks ───────────────────────────────────────── */}
      <div className="card">
        <div className="mb-1 flex items-center gap-2">
          <WebhookIcon className="h-4 w-4 text-brand-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Webhooks</h3>
        </div>
        <p className="mb-4 text-xs text-slate-400">
          We POST a signed JSON payload to your endpoint when events happen. Verify the
          <code className="mx-1 rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] dark:bg-slate-800">X-TaskFlow-Signature</code>
          header (HMAC-SHA256 of the raw body) using your endpoint secret.
        </p>

        {/* Secret reveal banner */}
        {revealedSecret && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" /> Signing secret — store it now
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded-lg bg-white px-2.5 py-1.5 font-mono text-xs text-slate-800 dark:bg-slate-900 dark:text-slate-200">{revealedSecret.secret}</code>
              <CopyButton text={revealedSecret.secret} />
              <button onClick={() => setRevealedSecret(null)} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">Done</button>
            </div>
          </div>
        )}

        {/* Create */}
        <div className="mb-4 space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <Input
            value={newHookUrl}
            onChange={(e) => setNewHookUrl(e.target.value)}
            placeholder="https://your-app.com/webhooks/taskflow"
          />
          <div className="flex flex-wrap gap-2">
            {WEBHOOK_EVENT_OPTIONS.map((ev) => (
              <button
                key={ev.value}
                type="button"
                onClick={() => toggleEvent(ev.value)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  newHookEvents.includes(ev.value)
                    ? 'border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-300'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400'
                )}
              >
                {ev.label}
              </button>
            ))}
          </div>
          <Button onClick={createHook} disabled={creatingHook || !newHookUrl.trim() || newHookEvents.length === 0} className="gap-1.5">
            {creatingHook ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add webhook
          </Button>
        </div>

        {/* List */}
        {loading ? null : hooks.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">No webhooks yet.</p>
        ) : (
          <div className="space-y-2">
            {hooks.map((hook) => (
              <div key={hook.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="truncate font-mono text-xs text-slate-700 dark:text-slate-300">{hook.url}</code>
                      <DeliveryPill hook={hook} />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {hook.events.includes('*') ? 'All events' : hook.events.join(', ')}
                    </p>
                    {hook.disabledReason && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-3 w-3" /> {hook.disabledReason}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => testHook(hook)}
                      disabled={testingId === hook.id}
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      aria-label="Send test delivery"
                      title="Send test event"
                    >
                      {testingId === hook.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => toggleHook(hook)}
                      className={cn(
                        'rounded-lg p-2 transition-colors',
                        hook.enabled
                          ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                          : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      )}
                      aria-label={hook.enabled ? 'Disable webhook' : 'Enable webhook'}
                      title={hook.enabled ? 'Enabled' : 'Disabled'}
                    >
                      <Power className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteHook(hook)}
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                      aria-label="Delete webhook"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <a
          href="/API.md"
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Read the API & webhook reference
        </a>
      </div>

      {/* ── Slack ──────────────────────────────────────────── */}
      <div className="card">
        <div className="mb-1 flex items-center gap-2">
          <SlackIcon className="h-4 w-4 text-brand-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Slack notifications</h3>
          {slack.connected && (
            <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
              Connected
            </span>
          )}
        </div>
        <p className="mb-4 text-xs text-slate-400">
          Post task &amp; comment updates to a Slack channel.{' '}
          <a
            href="https://api.slack.com/messaging/webhooks"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            Create an Incoming Webhook
          </a>{' '}
          in Slack, then paste its URL below.
        </p>

        {!slack.connected ? (
          <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <Input
              value={slackUrl}
              onChange={(e) => setSlackUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/T…/B…/…"
            />
            <div className="flex flex-wrap gap-2">
              {WEBHOOK_EVENT_OPTIONS.map((ev) => (
                <button
                  key={ev.value}
                  type="button"
                  onClick={() => toggleSlackEvent(ev.value)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    slackEvents.includes(ev.value)
                      ? 'border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-300'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400'
                  )}
                >
                  {ev.label}
                </button>
              ))}
            </div>
            <Button onClick={connectSlack} disabled={slackBusy || !slackUrl.trim() || slackEvents.length === 0} className="gap-1.5">
              {slackBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <SlackIcon className="h-4 w-4" />}
              Connect Slack
            </Button>
          </div>
        ) : (
          <div className="space-y-4 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <code className="font-mono text-xs text-slate-600 dark:text-slate-300">{slack.urlHint}</code>
                {slack.disabledReason && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-3 w-3" /> {slack.disabledReason}
                  </p>
                )}
              </div>
              <button
                onClick={toggleSlackEnabled}
                className={cn(
                  'shrink-0 rounded-lg p-2 transition-colors',
                  slack.enabled
                    ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                    : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                )}
                aria-label={slack.enabled ? 'Disable Slack' : 'Enable Slack'}
                title={slack.enabled ? 'Enabled' : 'Disabled'}
              >
                <Power className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {WEBHOOK_EVENT_OPTIONS.map((ev) => (
                <button
                  key={ev.value}
                  type="button"
                  onClick={() => toggleSlackEvent(ev.value)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    slackEvents.includes(ev.value)
                      ? 'border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-300'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400'
                  )}
                >
                  {ev.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={saveSlackEvents} disabled={slackBusy || slackEvents.length === 0} variant="secondary" className="gap-1.5">
                {slackBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save events
              </Button>
              <Button onClick={testSlackNow} disabled={testingSlack} variant="secondary" className="gap-1.5">
                {testingSlack ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send test
              </Button>
              <button
                onClick={disconnectSlack}
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"
              >
                <Unplug className="h-3.5 w-3.5" /> Disconnect
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
