import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Plus, Trash2, Pencil, Loader2, Calendar, X, Check, Flag,
} from 'lucide-react';
import { useTeamStore } from '@/store/teamStore';
import { useUIStore } from '@/store/uiStore';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn, formatDate } from '@/lib/utils';
import {
  goalService, GOAL_STATUS_META,
  type Goal, type GoalStatus, type KeyResultInput,
} from '@/services/goalService';

const STATUSES: GoalStatus[] = ['on_track', 'at_risk', 'off_track', 'achieved'];

const ProgressBar = ({ pct, color = '#e8502e' }: { pct: number; color?: string }) => (
  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
  </div>
);

const StatusBadge = ({ status }: { status: GoalStatus }) => {
  const m = GOAL_STATUS_META[status];
  return (
    <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: m.bg, color: m.color }}>
      {m.label}
    </span>
  );
};

/* ─── Goal card ───────────────────────────────────────────────────────────── */
const GoalCard = ({ goal, canEdit, onEdit, onDelete, onChange }: {
  goal: Goal; canEdit: boolean;
  onEdit: () => void; onDelete: () => void; onChange: (g: Goal) => void;
}) => {
  const { addToast } = useUIStore();
  const m = GOAL_STATUS_META[goal.status];

  const setKrCurrent = async (krId: string, current: number) => {
    const keyResults: KeyResultInput[] = goal.keyResults.map((kr) => ({
      title: kr.title,
      current: kr.id === krId ? current : kr.current,
      target: kr.target,
      unit: kr.unit,
    }));
    try {
      const updated = await goalService.update(goal.id, { keyResults });
      onChange(updated);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Could not update', message: err?.response?.data?.message });
    }
  };

  return (
    <div className="card flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold leading-snug tracking-tight text-slate-900 dark:text-slate-100">{goal.title}</h3>
          {goal.description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{goal.description}</p>}
        </div>
        {canEdit && (
          <div className="flex flex-shrink-0 items-center gap-1">
            <button onClick={onEdit} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800" aria-label="Edit goal"><Pencil className="h-4 w-4" /></button>
            <button onClick={onDelete} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10" aria-label="Delete goal"><Trash2 className="h-4 w-4" /></button>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge status={goal.status} />
        {goal.owner?.name && (
          <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Avatar name={goal.owner.name} src={goal.owner.avatar} size="xs" /> {goal.owner.name}
          </span>
        )}
        {goal.dueDate && (
          <span className="flex items-center gap-1 text-xs text-slate-400"><Calendar className="h-3 w-3" /> {formatDate(goal.dueDate)}</span>
        )}
      </div>

      {/* Overall progress */}
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-medium text-slate-500 dark:text-slate-400">Progress</span>
          <span className="font-mono font-semibold" style={{ color: m.color }}>{goal.progress}%</span>
        </div>
        <ProgressBar pct={goal.progress} color={m.color} />
      </div>

      {/* Key results */}
      {goal.keyResults.length > 0 && (
        <div className="mt-4 space-y-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
          {goal.keyResults.map((kr) => {
            const pct = kr.target > 0 ? Math.min(100, Math.round((kr.current / kr.target) * 100)) : 0;
            return (
              <div key={kr.id}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-300">{kr.title}</span>
                  <div className="flex flex-shrink-0 items-center gap-1 text-slate-400">
                    {canEdit ? (
                      <input
                        type="number"
                        defaultValue={kr.current}
                        onBlur={(e) => { const v = Number(e.target.value); if (v !== kr.current) setKrCurrent(kr.id, v); }}
                        className="w-14 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-right font-mono text-xs text-slate-700 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      />
                    ) : (
                      <span className="font-mono">{kr.current}</span>
                    )}
                    <span className="font-mono">/ {kr.target}{kr.unit ? ` ${kr.unit}` : ''}</span>
                  </div>
                </div>
                <div className="mt-1"><ProgressBar pct={pct} /></div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ─── Create / edit modal ─────────────────────────────────────────────────── */
const emptyDraft = () => ({
  title: '', description: '', ownerId: '' as string, status: 'on_track' as GoalStatus, dueDate: '',
  keyResults: [{ title: '', current: 0, target: 100, unit: '' }] as KeyResultInput[],
});

const GoalModal = ({ goal, members, onClose, onSaved }: {
  goal: Goal | null;
  members: { id: string; name: string; avatar?: string | null }[];
  onClose: () => void;
  onSaved: (g: Goal, isNew: boolean) => void;
}) => {
  const { activeTeam } = useTeamStore();
  const { addToast } = useUIStore();
  const [d, setD] = useState(() => goal
    ? {
        title: goal.title, description: goal.description, ownerId: goal.owner?.id || '',
        status: goal.status, dueDate: goal.dueDate ? goal.dueDate.slice(0, 10) : '',
        keyResults: goal.keyResults.map((k) => ({ title: k.title, current: k.current, target: k.target, unit: k.unit })),
      }
    : emptyDraft());
  const [saving, setSaving] = useState(false);

  const setKr = (i: number, patch: Partial<KeyResultInput>) =>
    setD((s) => ({ ...s, keyResults: s.keyResults.map((k, idx) => idx === i ? { ...k, ...patch } : k) }));

  const valid = d.title.trim().length > 0;

  const save = async () => {
    if (!activeTeam || !valid || saving) return;
    setSaving(true);
    const body = {
      title: d.title.trim(),
      description: d.description.trim(),
      ownerId: d.ownerId || null,
      status: d.status,
      dueDate: d.dueDate || null,
      keyResults: d.keyResults.filter((k) => k.title.trim()).map((k) => ({ ...k, title: k.title.trim() })),
    };
    try {
      const result = goal ? await goalService.update(goal.id, body) : await goalService.create(activeTeam._id, body);
      onSaved(result, !goal);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Could not save goal', message: err?.response?.data?.message });
      setSaving(false);
    }
  };

  const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto p-4 pt-16">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: -12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{goal ? 'Edit goal' : 'New goal'}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-3">
          <Input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="Objective (e.g. Launch v2 to all customers)" autoFocus />
          <textarea value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} placeholder="Why does this matter?" rows={2} className={cn(field, 'resize-none')} />

          <div className="grid grid-cols-2 gap-3">
            <select value={d.ownerId} onChange={(e) => setD({ ...d, ownerId: e.target.value })} className={field}>
              <option value="">No owner</option>
              {members.map((mem) => <option key={mem.id} value={mem.id}>{mem.name}</option>)}
            </select>
            <select value={d.status} onChange={(e) => setD({ ...d, status: e.target.value as GoalStatus })} className={field}>
              {STATUSES.map((s) => <option key={s} value={s}>{GOAL_STATUS_META[s].label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Target date</label>
            <input type="date" value={d.dueDate} onChange={(e) => setD({ ...d, dueDate: e.target.value })} className={field} />
          </div>

          {/* Key results */}
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400"><Flag className="h-3 w-3" /> Key results</p>
            <div className="space-y-2">
              {d.keyResults.map((kr, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={kr.title} onChange={(e) => setKr(i, { title: e.target.value })} placeholder="Measurable result" className={cn(field, 'flex-1')} />
                  <input type="number" value={kr.target} onChange={(e) => setKr(i, { target: Number(e.target.value) })} className={cn(field, 'w-20')} title="Target" />
                  <input value={kr.unit} onChange={(e) => setKr(i, { unit: e.target.value })} placeholder="unit" className={cn(field, 'w-16')} />
                  {d.keyResults.length > 1 && (
                    <button onClick={() => setD((s) => ({ ...s, keyResults: s.keyResults.filter((_, idx) => idx !== i) }))} className="rounded p-1 text-slate-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setD((s) => ({ ...s, keyResults: [...s.keyResults, { title: '', current: 0, target: 100, unit: '' }] }))} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"><Plus className="h-3 w-3" /> Add key result</button>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">Cancel</button>
          <Button onClick={save} disabled={!valid || saving} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {goal ? 'Save' : 'Create goal'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

/* ─── Page ────────────────────────────────────────────────────────────────── */
export const GoalsPage = () => {
  const { activeTeam } = useTeamStore();
  const { addToast, showConfirm } = useUIStore();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; goal: Goal | null }>({ open: false, goal: null });

  const members = useMemo(
    () => ((activeTeam?.members as any[]) || []).map((m) => m.user || m).filter((u: any) => u?._id).map((u: any) => ({ id: u._id, name: u.name, avatar: u.avatar })),
    [activeTeam]
  );

  useEffect(() => {
    if (!activeTeam) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    goalService.list(activeTeam._id)
      .then((g) => active && setGoals(g))
      .catch(() => active && addToast({ type: 'error', title: 'Failed to load goals' }))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [activeTeam?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const canEdit = (g: Goal) => true; // server enforces; UI shows controls, errors surface as toasts

  const remove = async (g: Goal) => {
    const ok = await showConfirm({ title: `Delete “${g.title}”?`, message: 'This goal and its key results will be removed.', confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;
    try {
      await goalService.remove(g.id);
      setGoals((p) => p.filter((x) => x.id !== g.id));
    } catch (err: any) {
      addToast({ type: 'error', title: 'Could not delete goal', message: err?.response?.data?.message });
    }
  };

  if (!activeTeam) {
    return <PageContainer width="default"><div className="card text-sm text-slate-500 dark:text-slate-400">Select a team to view goals.</div></PageContainer>;
  }

  return (
    <PageContainer width="default">
      <PageHeader
        icon={Target}
        title="Goals & OKRs"
        description={`Objectives and key results for ${activeTeam.name}`}
        actions={<Button onClick={() => setModal({ open: true, goal: null })} className="gap-2"><Plus className="h-4 w-4" /> New goal</Button>}
      />

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" /></div>
      ) : goals.length === 0 ? (
        <div className="card flex flex-col items-center gap-4 py-16 text-center">
          <div className="rounded-2xl bg-slate-100 p-5 dark:bg-slate-800"><Target className="h-7 w-7 text-slate-400" /></div>
          <div>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No goals yet</p>
            <p className="mt-1 text-xs text-slate-400">Set an objective and track it with measurable key results.</p>
          </div>
          <Button onClick={() => setModal({ open: true, goal: null })} className="gap-2"><Plus className="h-4 w-4" /> Create your first goal</Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              canEdit={canEdit(g)}
              onEdit={() => setModal({ open: true, goal: g })}
              onDelete={() => remove(g)}
              onChange={(updated) => setGoals((p) => p.map((x) => x.id === updated.id ? updated : x))}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {modal.open && (
          <GoalModal
            goal={modal.goal}
            members={members}
            onClose={() => setModal({ open: false, goal: null })}
            onSaved={(g, isNew) => {
              setGoals((p) => isNew ? [g, ...p] : p.map((x) => x.id === g.id ? g : x));
              setModal({ open: false, goal: null });
              addToast({ type: 'success', title: isNew ? 'Goal created' : 'Goal updated' });
            }}
          />
        )}
      </AnimatePresence>
    </PageContainer>
  );
};
