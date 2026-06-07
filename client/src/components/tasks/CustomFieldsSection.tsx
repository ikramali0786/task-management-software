import { useEffect, useState } from 'react';
import { ListPlus } from 'lucide-react';
import { useTaskStore } from '@/store/taskStore';
import { useUIStore } from '@/store/uiStore';
import { customFieldService, type CustomFieldDef } from '@/services/customFieldService';

interface Props {
  taskId: string;
  teamId: string;
  values: Record<string, unknown>;
}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';

export const CustomFieldsSection = ({ taskId, teamId, values }: Props) => {
  const { applySocketUpdate } = useTaskStore();
  const { addToast } = useUIStore();
  const [fields, setFields] = useState<CustomFieldDef[]>([]);
  const [vals, setVals] = useState<Record<string, any>>(values || {});

  useEffect(() => { setVals(values || {}); }, [values]);

  useEffect(() => {
    let active = true;
    customFieldService.list(teamId).then((f) => active && setFields(f)).catch(() => {});
    return () => { active = false; };
  }, [teamId]);

  if (fields.length === 0) return null;

  const commit = async (fieldId: string, value: any) => {
    const next = { ...vals, [fieldId]: value };
    setVals(next);
    try {
      const saved = await customFieldService.setTaskValues(taskId, { [fieldId]: value });
      applySocketUpdate(taskId, { customFields: saved } as any);
    } catch {
      addToast({ type: 'error', title: 'Could not save field' });
    }
  };

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-4 dark:border-slate-700/60 dark:bg-slate-800/40">
      <div className="mb-3 flex items-center gap-2">
        <ListPlus className="h-4 w-4 text-slate-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Custom fields</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map((f) => {
          const v = vals[f.id];
          return (
            <div key={f.id}>
              <label className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">{f.name}</label>
              {f.type === 'text' && (
                <input className={inputCls} defaultValue={(v as string) || ''} onBlur={(e) => commit(f.id, e.target.value)} placeholder="—" />
              )}
              {f.type === 'number' && (
                <input type="number" className={inputCls} defaultValue={v ?? ''} onBlur={(e) => commit(f.id, e.target.value === '' ? '' : Number(e.target.value))} placeholder="—" />
              )}
              {f.type === 'date' && (
                <input type="date" className={inputCls} value={(v as string)?.slice(0, 10) || ''} onChange={(e) => commit(f.id, e.target.value)} />
              )}
              {f.type === 'select' && (
                <select className={inputCls} value={(v as string) || ''} onChange={(e) => commit(f.id, e.target.value)}>
                  <option value="">—</option>
                  {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              )}
              {f.type === 'checkbox' && (
                <label className="flex h-9 items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <input type="checkbox" checked={Boolean(v)} onChange={(e) => commit(f.id, e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500" />
                  {Boolean(v) ? 'Yes' : 'No'}
                </label>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
