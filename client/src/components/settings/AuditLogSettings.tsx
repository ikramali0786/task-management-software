import { useEffect, useState } from 'react';
import {
  ScrollText, Loader2, Sparkles, CheckCircle2, PlusCircle, Pencil, Trash2,
  UserPlus, UserMinus, Shield, CreditCard, Dot,
} from 'lucide-react';
import { usePlan } from '@/hooks/usePlan';
import { useUIStore } from '@/store/uiStore';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { formatLastSeen } from '@/lib/utils';
import { auditService, AUDIT_ACTION_LABELS, AUDIT_ACTION_FILTERS, type AuditEntry } from '@/services/auditService';

const ICONS: Record<string, React.ElementType> = {
  'task.created': PlusCircle,
  'task.updated': Pencil,
  'task.completed': CheckCircle2,
  'task.deleted': Trash2,
  'member.joined': UserPlus,
  'member.left': UserMinus,
  'member.removed': UserMinus,
  'role.updated': Shield,
  'billing.updated': CreditCard,
};

const Gate = () => {
  const openUpgrade = useUIStore((s) => s.openUpgrade);
  return (
    <div className="card flex flex-col items-center gap-4 py-12 text-center">
      <div className="gradient-brand inline-flex h-12 w-12 items-center justify-center rounded-xl">
        <ScrollText className="h-6 w-6 text-white" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">The audit log is a Business feature</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
          Keep a complete, immutable record of who did what — task changes, membership, roles, and
          billing. Available on the Business plan.
        </p>
      </div>
      <Button onClick={() => openUpgrade('auditLog')} className="gap-2">
        <Sparkles className="h-4 w-4" /> Upgrade to Business
      </Button>
    </div>
  );
};

export const AuditLogSettings = () => {
  const { can, team } = usePlan();
  const { addToast } = useUIStore();
  const teamId = team?._id;
  const hasFeature = can('auditLog');

  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const load = async (p: number, act: string, append: boolean) => {
    if (!teamId) return;
    append ? setLoadingMore(true) : setLoading(true);
    try {
      const res = await auditService.list(teamId, { page: p, action: act || undefined, limit: 40 });
      setLogs((prev) => (append ? [...prev, ...res.logs] : res.logs));
      setPage(res.page);
      setPages(res.pages);
    } catch {
      addToast({ type: 'error', title: 'Failed to load audit log' });
    } finally {
      append ? setLoadingMore(false) : setLoading(false);
    }
  };

  useEffect(() => {
    if (!teamId || !hasFeature) { setLoading(false); return; }
    load(1, action, false);
  }, [teamId, hasFeature, action]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!team) return <div className="card text-sm text-slate-500 dark:text-slate-400">Select a team to view its audit log.</div>;
  if (!hasFeature) return <Gate />;

  const describe = (e: AuditEntry) => {
    const verb = AUDIT_ACTION_LABELS[e.action] || e.action;
    if (e.action === 'role.updated' && e.meta?.from && e.meta?.to) return `${verb} (${e.meta.from} → ${e.meta.to})`;
    if (e.action === 'billing.updated' && e.meta?.plan) return `${verb} → ${e.meta.plan}`;
    return verb;
  };

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-brand-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Audit log</h3>
        </div>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          {AUDIT_ACTION_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></div>
      ) : logs.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">No activity recorded yet.</p>
      ) : (
        <>
          <div className="space-y-1">
            {logs.map((e) => {
              const Icon = ICONS[e.action] || Dot;
              return (
                <div key={e.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  {e.actor ? (
                    <Avatar name={e.actor.name} src={e.actor.avatar} size="xs" />
                  ) : (
                    <span className="text-[11px] font-medium text-slate-400">System</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-700 dark:text-slate-200">
                      <span className="font-medium">{e.actor?.name || 'System'}</span>{' '}
                      <span className="text-slate-500 dark:text-slate-400">{describe(e)}</span>
                      {e.target?.label && <span className="text-slate-700 dark:text-slate-300"> · {e.target.label}</span>}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-slate-400">{formatLastSeen(e.createdAt).label.replace('Active · ', '')}</span>
                </div>
              );
            })}
          </div>

          {page < pages && (
            <div className="mt-4 flex justify-center">
              <Button variant="secondary" onClick={() => load(page + 1, action, true)} disabled={loadingMore} className="gap-1.5">
                {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
