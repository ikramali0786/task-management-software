import { useEffect, useState } from 'react';
import { Zap, Plus, Trash2, Loader2, Sparkles, Power, ArrowRight } from 'lucide-react';
import { usePlan } from '@/hooks/usePlan';
import { useUIStore } from '@/store/uiStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import {
  automationService,
  TRIGGER_OPTIONS, CONDITION_OPTIONS, ACTION_OPTIONS, PRIORITY_VALUES, STATUS_VALUES,
  type AutomationRule, type AutomationCondition, type AutomationAction,
  type AutomationTrigger, type ConditionField, type ActionType,
} from '@/services/automationService';

const selectCls =
  'h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';

const emptyDraft = (): { name: string; trigger: AutomationTrigger; conditions: AutomationCondition[]; actions: AutomationAction[] } => ({
  name: '',
  trigger: 'task.created',
  conditions: [],
  actions: [{ type: 'setPriority', value: 'high' }],
});

const Gate = () => {
  const openUpgrade = useUIStore((s) => s.openUpgrade);
  return (
    <div className="card flex flex-col items-center gap-4 py-12 text-center">
      <div className="gradient-brand inline-flex h-12 w-12 items-center justify-center rounded-xl">
        <Zap className="h-6 w-6 text-white" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Automations are a Pro feature</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
          Set up “if this, then that” rules — auto-assign, re-prioritize, label, or comment when tasks
          change. Available on the Pro and Business plans.
        </p>
      </div>
      <Button onClick={() => openUpgrade('automations')} className="gap-2">
        <Sparkles className="h-4 w-4" /> Upgrade to unlock
      </Button>
    </div>
  );
};

export const AutomationSettings = () => {
  const { can, team } = usePlan();
  const { addToast, showConfirm } = useUIStore();
  const teamId = team?._id;
  const members = ((team?.members as any[]) || []).map((m: any) => m.user || m).filter((u: any) => u && u._id);

  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(emptyDraft());
  const [saving, setSaving] = useState(false);

  const hasFeature = can('automations');

  useEffect(() => {
    if (!teamId || !hasFeature) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    automationService.list(teamId)
      .then((r) => active && setRules(r))
      .catch(() => active && addToast({ type: 'error', title: 'Failed to load automations' }))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [teamId, hasFeature]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!team) return <div className="card text-sm text-slate-500 dark:text-slate-400">Select a team to manage automations.</div>;
  if (!hasFeature) return <Gate />;

  // ── Draft editing helpers ──────────────────────────────────────────────
  const defaultConditionValue = (f: ConditionField) =>
    f === 'priority' ? 'high' : f === 'status' ? 'todo' : f === 'unassigned' ? true : '';
  const defaultActionValue = (t: ActionType): any =>
    t === 'setPriority' ? 'high' : t === 'setStatus' ? 'in_progress'
      : t === 'addLabel' ? { name: '', color: '#e8502e' } : t === 'assignTo' ? (members[0]?._id || '')
      : t === 'setDueInDays' ? 3 : '';

  const addCondition = () => setDraft((d) => ({ ...d, conditions: [...d.conditions, { field: 'priority', value: 'high' }] }));
  const addAction = () => setDraft((d) => ({ ...d, actions: [...d.actions, { type: 'setPriority', value: 'high' }] }));

  const valid = draft.name.trim() && draft.actions.length > 0 && draft.actions.every((a) => {
    if (a.type === 'addLabel') return a.value?.name?.trim();
    if (a.type === 'assignTo') return Boolean(a.value);
    if (a.type === 'addComment') return String(a.value || '').trim();
    return a.value !== '' && a.value != null;
  });

  const save = async () => {
    if (!teamId || !valid) return;
    setSaving(true);
    try {
      const rule = await automationService.create({ teamId, ...draft });
      setRules((prev) => [rule, ...prev]);
      setDraft(emptyDraft());
      addToast({ type: 'success', title: 'Automation created' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Could not create automation', message: err?.response?.data?.message });
    } finally {
      setSaving(false);
    }
  };

  const toggleRule = async (rule: AutomationRule) => {
    if (!teamId) return;
    try {
      const updated = await automationService.update(rule.id, { enabled: !rule.enabled });
      setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
    } catch {
      addToast({ type: 'error', title: 'Could not update automation' });
    }
  };

  const removeRule = async (rule: AutomationRule) => {
    const ok = await showConfirm({
      title: `Delete “${rule.name}”?`,
      message: 'This automation will stop running. This cannot be undone.',
      confirmLabel: 'Delete', variant: 'danger',
    });
    if (!ok) return;
    try {
      await automationService.remove(rule.id);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
    } catch {
      addToast({ type: 'error', title: 'Could not delete automation' });
    }
  };

  // ── Value editors ───────────────────────────────────────────────────────
  const conditionValueEditor = (c: AutomationCondition, i: number) => {
    const set = (value: any) => setDraft((d) => ({ ...d, conditions: d.conditions.map((x, idx) => idx === i ? { ...x, value } : x) }));
    if (c.field === 'priority') return <select className={selectCls} value={c.value} onChange={(e) => set(e.target.value)}>{PRIORITY_VALUES.map((p) => <option key={p} value={p}>{p}</option>)}</select>;
    if (c.field === 'status') return <select className={selectCls} value={c.value} onChange={(e) => set(e.target.value)}>{STATUS_VALUES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select>;
    if (c.field === 'unassigned') return <span className="text-xs text-slate-400">(true)</span>;
    return <input className={cn(selectCls, 'w-40')} value={c.value} onChange={(e) => set(e.target.value)} placeholder="text…" />;
  };

  const actionValueEditor = (a: AutomationAction, i: number) => {
    const set = (value: any) => setDraft((d) => ({ ...d, actions: d.actions.map((x, idx) => idx === i ? { ...x, value } : x) }));
    if (a.type === 'setPriority') return <select className={selectCls} value={a.value} onChange={(e) => set(e.target.value)}>{PRIORITY_VALUES.map((p) => <option key={p} value={p}>{p}</option>)}</select>;
    if (a.type === 'setStatus') return <select className={selectCls} value={a.value} onChange={(e) => set(e.target.value)}>{STATUS_VALUES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select>;
    if (a.type === 'addLabel') return <input className={cn(selectCls, 'w-40')} value={a.value?.name || ''} onChange={(e) => set({ name: e.target.value, color: a.value?.color || '#e8502e' })} placeholder="label name…" />;
    if (a.type === 'assignTo') return <select className={selectCls} value={a.value} onChange={(e) => set(e.target.value)}>{members.length === 0 && <option value="">no members</option>}{members.map((m: any) => <option key={m._id} value={m._id}>{m.name}</option>)}</select>;
    if (a.type === 'setDueInDays') return <input type="number" min={0} className={cn(selectCls, 'w-20')} value={a.value} onChange={(e) => set(Number(e.target.value))} />;
    return <input className={cn(selectCls, 'w-56')} value={a.value} onChange={(e) => set(e.target.value)} placeholder="comment…" />;
  };

  const summarize = (rule: AutomationRule) => {
    const trig = TRIGGER_OPTIONS.find((t) => t.value === rule.trigger)?.label || rule.trigger;
    const conds = rule.conditions.map((c) => {
      const lbl = CONDITION_OPTIONS.find((o) => o.value === c.field)?.label || c.field;
      return c.field === 'unassigned' ? lbl : `${lbl} ${typeof c.value === 'object' ? c.value?.name : c.value}`;
    });
    const acts = rule.actions.map((a) => {
      const lbl = ACTION_OPTIONS.find((o) => o.value === a.type)?.label || a.type;
      return `${lbl} ${typeof a.value === 'object' ? a.value?.name : a.value}`;
    });
    return { trig, conds, acts };
  };

  return (
    <div className="space-y-5">
      {/* Builder */}
      <div className="card">
        <div className="mb-4 flex items-center gap-2">
          <Zap className="h-4 w-4 text-brand-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">New automation</h3>
        </div>

        <div className="space-y-4">
          <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Automation name (e.g. Triage urgent bugs)" />

          {/* WHEN */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 text-[11px] font-bold uppercase tracking-wide text-brand-500">When</span>
            <select className={selectCls} value={draft.trigger} onChange={(e) => setDraft({ ...draft, trigger: e.target.value as AutomationTrigger })}>
              {TRIGGER_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* IF */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-16 text-[11px] font-bold uppercase tracking-wide text-slate-400">If</span>
              <span className="text-xs text-slate-400">{draft.conditions.length === 0 ? 'Always (no conditions)' : 'All of:'}</span>
            </div>
            {draft.conditions.map((c, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 pl-16">
                <select className={selectCls} value={c.field} onChange={(e) => { const field = e.target.value as ConditionField; setDraft((d) => ({ ...d, conditions: d.conditions.map((x, idx) => idx === i ? { field, value: defaultConditionValue(field) } : x) })); }}>
                  {CONDITION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {conditionValueEditor(c, i)}
                <button onClick={() => setDraft((d) => ({ ...d, conditions: d.conditions.filter((_, idx) => idx !== i) }))} className="rounded p-1 text-slate-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            <button onClick={addCondition} className="ml-16 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"><Plus className="h-3 w-3" /> Add condition</button>
          </div>

          {/* THEN */}
          <div className="space-y-2">
            <span className="w-16 text-[11px] font-bold uppercase tracking-wide text-emerald-500">Then</span>
            {draft.actions.map((a, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 pl-16">
                <select className={selectCls} value={a.type} onChange={(e) => { const type = e.target.value as ActionType; setDraft((d) => ({ ...d, actions: d.actions.map((x, idx) => idx === i ? { type, value: defaultActionValue(type) } : x) })); }}>
                  {ACTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {actionValueEditor(a, i)}
                {draft.actions.length > 1 && (
                  <button onClick={() => setDraft((d) => ({ ...d, actions: d.actions.filter((_, idx) => idx !== i) }))} className="rounded p-1 text-slate-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                )}
              </div>
            ))}
            <button onClick={addAction} className="ml-16 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"><Plus className="h-3 w-3" /> Add action</button>
          </div>

          <div className="flex justify-end">
            <Button onClick={save} disabled={!valid || saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create automation
            </Button>
          </div>
        </div>
      </div>

      {/* Existing rules */}
      <div className="card">
        <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Active automations</h3>
        {loading ? (
          <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></div>
        ) : rules.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">No automations yet.</p>
        ) : (
          <div className="space-y-2">
            {rules.map((rule) => {
              const s = summarize(rule);
              return (
                <div key={rule.id} className={cn('rounded-xl border p-3', rule.enabled ? 'border-slate-200 dark:border-slate-700' : 'border-slate-100 opacity-60 dark:border-slate-800')}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{rule.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="rounded bg-brand-50 px-1.5 py-0.5 font-medium text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">{s.trig}</span>
                        {s.conds.map((c, i) => <span key={i} className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">{c}</span>)}
                        <ArrowRight className="h-3 w-3 text-slate-300" />
                        {s.acts.map((a, i) => <span key={i} className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">{a}</span>)}
                      </div>
                      <p className="mt-1 text-[10px] text-slate-400">Ran {rule.runCount}× {rule.lastRunAt ? `· last ${new Date(rule.lastRunAt).toLocaleDateString()}` : ''}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button onClick={() => toggleRule(rule)} className={cn('rounded-lg p-2 transition-colors', rule.enabled ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800')} title={rule.enabled ? 'Enabled' : 'Disabled'}><Power className="h-4 w-4" /></button>
                      <button onClick={() => removeRule(rule)} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
