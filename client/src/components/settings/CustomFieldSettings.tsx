import { useEffect, useState } from 'react';
import { ListPlus, Plus, Trash2, Loader2, Sparkles } from 'lucide-react';
import { usePlan } from '@/hooks/usePlan';
import { useUIStore } from '@/store/uiStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import {
  customFieldService, FIELD_TYPE_OPTIONS,
  type CustomFieldDef, type CustomFieldType,
} from '@/services/customFieldService';

const TYPE_LABEL: Record<CustomFieldType, string> = {
  text: 'Text', number: 'Number', select: 'Select', date: 'Date', checkbox: 'Checkbox',
};

const Gate = () => {
  const openUpgrade = useUIStore((s) => s.openUpgrade);
  return (
    <div className="card flex flex-col items-center gap-4 py-12 text-center">
      <div className="gradient-brand inline-flex h-12 w-12 items-center justify-center rounded-xl">
        <ListPlus className="h-6 w-6 text-white" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Custom fields are a Pro feature</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
          Add your own fields to tasks — text, number, dropdown, date, or checkbox — to track exactly
          what your team needs. Available on the Pro and Business plans.
        </p>
      </div>
      <Button onClick={() => openUpgrade('customFields')} className="gap-2">
        <Sparkles className="h-4 w-4" /> Upgrade to unlock
      </Button>
    </div>
  );
};

export const CustomFieldSettings = () => {
  const { can, team } = usePlan();
  const { addToast, showConfirm } = useUIStore();
  const teamId = team?._id;
  const hasFeature = can('customFields');

  const [fields, setFields] = useState<CustomFieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [type, setType] = useState<CustomFieldType>('text');
  const [optionsText, setOptionsText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!teamId || !hasFeature) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    customFieldService.list(teamId)
      .then((f) => active && setFields(f))
      .catch(() => active && addToast({ type: 'error', title: 'Failed to load custom fields' }))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [teamId, hasFeature]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!team) return <div className="card text-sm text-slate-500 dark:text-slate-400">Select a team to manage custom fields.</div>;
  if (!hasFeature) return <Gate />;

  const create = async () => {
    if (!teamId || !name.trim()) return;
    const options = type === 'select' ? optionsText.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
    if (type === 'select' && (!options || options.length === 0)) {
      addToast({ type: 'error', title: 'Add at least one option for a select field' });
      return;
    }
    setSaving(true);
    try {
      const field = await customFieldService.create({ teamId, name: name.trim(), type, options });
      setFields((prev) => [...prev, field]);
      setName(''); setOptionsText(''); setType('text');
      addToast({ type: 'success', title: 'Field added' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Could not add field', message: err?.response?.data?.message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (field: CustomFieldDef) => {
    const ok = await showConfirm({
      title: `Delete field “${field.name}”?`,
      message: 'The field is removed from all task forms. Existing values are hidden.',
      confirmLabel: 'Delete', variant: 'danger',
    });
    if (!ok) return;
    try {
      await customFieldService.remove(field.id);
      setFields((prev) => prev.filter((f) => f.id !== field.id));
    } catch {
      addToast({ type: 'error', title: 'Could not delete field' });
    }
  };

  return (
    <div className="space-y-5">
      <div className="card">
        <div className="mb-4 flex items-center gap-2">
          <ListPlus className="h-4 w-4 text-brand-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">New custom field</h3>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Field name (e.g. Story points)" className="flex-1" />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as CustomFieldType)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {FIELD_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <Button onClick={create} disabled={saving || !name.trim()} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
          </Button>
        </div>
        {type === 'select' && (
          <Input
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            placeholder="Options, comma-separated (e.g. Low, Medium, High)"
            className="mt-2"
          />
        )}
      </div>

      <div className="card">
        <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Fields</h3>
        {loading ? (
          <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></div>
        ) : fields.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">No custom fields yet.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {fields.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{f.name}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">{TYPE_LABEL[f.type]}</span>
                  </div>
                  {f.type === 'select' && f.options.length > 0 && (
                    <p className="mt-0.5 truncate text-xs text-slate-400">{f.options.join(' · ')}</p>
                  )}
                </div>
                <button onClick={() => remove(f)} className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10" aria-label="Delete field">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
