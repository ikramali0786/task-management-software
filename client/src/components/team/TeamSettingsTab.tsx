import { useState, useEffect } from 'react';
import {
  Trash2, Edit2, Save, Settings, ChevronDown, KeyRound, Bot, AlertTriangle, Tag, Shield,
} from 'lucide-react';
import { useTeamStore } from '@/store/teamStore';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { teamService } from '@/services/teamService';
import { apiKeyService } from '@/services/apiKeyService';
import { labelService } from '@/services/labelService';
import { Button } from '@/components/ui/Button';
import { RolesManager } from '@/components/team/RolesManager';
import { cn } from '@/lib/utils';
import { TaskPriority, TeamApiKey, TeamLabel } from '@/types';

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];
const PRESET_COLORS = ['#e8502e', '#22c55e', '#ef4444', '#f59e0b', '#ec4899', '#0ea5e9'];

export const TeamSettingsTab = () => {
  const { activeTeam, fetchTeams } = useTeamStore();
  const { addToast, showConfirm } = useUIStore();

  // Team edit
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPriority, setEditPriority] = useState<TaskPriority>('medium');
  const [editAllowInvite, setEditAllowInvite] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);

  // Labels
  const [labels, setLabels] = useState<TeamLabel[]>([]);
  const [labelsLoaded, setLabelsLoaded] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#e8502e');
  const [addingLabel, setAddingLabel] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editLabelName, setEditLabelName] = useState('');

  // API key
  const [apiKeyData, setApiKeyData] = useState<TeamApiKey | null>(null);
  const [apiKeyLoaded, setApiKeyLoaded] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeyLabel, setApiKeyLabel] = useState('');
  const [apiKeyModel, setApiKeyModel] = useState('gpt-4o-mini');
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [deletingApiKey, setDeletingApiKey] = useState(false);
  const [apiKeyError, setApiKeyError] = useState('');

  // Sync edit fields + reset lazy data when the team changes.
  useEffect(() => {
    if (!activeTeam) return;
    setEditName(activeTeam.name);
    setEditDesc(activeTeam.description || '');
    setEditPriority(activeTeam.settings?.defaultTaskPriority || 'medium');
    setEditAllowInvite(activeTeam.settings?.allowMemberInvite ?? true);
    setApiKeyData(null); setApiKeyLoaded(false); setApiKeyInput(''); setApiKeyLabel(''); setApiKeyModel('gpt-4o-mini');
    setLabels([]); setLabelsLoaded(false);
  }, [activeTeam?._id]);

  // Lazy-load labels + API key on mount (this tab only renders when settings is open).
  useEffect(() => {
    if (!activeTeam || labelsLoaded) return;
    labelService.getLabels(activeTeam._id).then((l) => setLabels(l ?? [])).catch(() => {}).finally(() => setLabelsLoaded(true));
  }, [activeTeam?._id, labelsLoaded]);
  useEffect(() => {
    if (!activeTeam || apiKeyLoaded) return;
    apiKeyService.getKey(activeTeam._id).then((k) => { setApiKeyData(k); if (k) setApiKeyModel(k.model); }).catch(() => {}).finally(() => setApiKeyLoaded(true));
  }, [activeTeam?._id, apiKeyLoaded]);

  const { user } = useAuthStore();
  if (!activeTeam) return null;
  const isOwner = activeTeam.owner._id === user?._id;
  const currentMember = activeTeam.members.find((m) => m.user._id === user?._id);
  const isAdmin = isOwner || currentMember?.role === 'admin';

  const handleSaveSettings = async () => {
    if (!editName.trim()) return;
    setSavingEdit(true);
    try {
      await teamService.updateTeam(activeTeam._id, {
        name: editName.trim(),
        description: editDesc.trim(),
        settings: { ...activeTeam.settings, defaultTaskPriority: editPriority, allowMemberInvite: editAllowInvite },
      });
      await fetchTeams();
      addToast({ type: 'success', title: 'Team settings saved' });
    } catch {
      addToast({ type: 'error', title: 'Failed to save settings' });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) return;
    if (!apiKeyInput.trim().startsWith('sk-')) {
      setApiKeyError('API key must start with "sk-"');
      return;
    }
    setApiKeyError('');
    setSavingApiKey(true);
    try {
      const saved = await apiKeyService.setKey(activeTeam._id, {
        key: apiKeyInput.trim(),
        label: apiKeyLabel.trim() || undefined,
        model: apiKeyModel,
      });
      setApiKeyData(saved);
      setApiKeyInput('');
      setApiKeyLabel('');
      addToast({ type: 'success', title: 'API key saved', message: 'Your OpenAI key has been encrypted and stored.' });
    } catch (err: any) {
      addToast({ type: 'error', title: err.response?.data?.message || 'Failed to save API key' });
    } finally {
      setSavingApiKey(false);
    }
  };

  const handleDeleteApiKey = async () => {
    const ok = await showConfirm({
      title: 'Remove API Key',
      message: 'Remove the OpenAI API key? Chatbots will stop working until a new key is added.',
      confirmLabel: 'Remove',
      variant: 'danger',
    });
    if (!ok) return;
    setDeletingApiKey(true);
    try {
      await apiKeyService.deleteKey(activeTeam._id);
      setApiKeyData(null);
      setApiKeyInput('');
      addToast({ type: 'success', title: 'API key removed' });
    } catch {
      addToast({ type: 'error', title: 'Failed to remove API key' });
    } finally {
      setDeletingApiKey(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="card flex flex-col items-center py-14 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
          <Settings className="h-6 w-6 text-slate-400 dark:text-slate-500" />
        </div>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Admins only</p>
        <p className="mt-1 text-xs text-slate-400">Only team admins can access these settings.</p>
      </div>
    );
  }

  const fieldClass =
    'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 transition-all focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';

  return (
    <div className="space-y-6">
      {/* Team info */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/10">
            <Edit2 className="h-5 w-5 text-brand-500" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Team info</h3>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">Team name</label>
          <input value={editName} onChange={(e) => setEditName(e.target.value)} className={fieldClass} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">Description</label>
          <textarea
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            rows={2}
            placeholder="What is this team working on?"
            className={cn(fieldClass, 'resize-none placeholder:text-slate-400')}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">Default task priority</label>
          <div className="relative">
            <select
              value={editPriority}
              onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
              className={cn(fieldClass, 'appearance-none pr-8')}
            >
              {PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Allow member invites</p>
            <p className="text-xs text-slate-400">Non-admins can generate invite codes.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={editAllowInvite}
            onClick={() => setEditAllowInvite((v) => !v)}
            className={cn('relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors', editAllowInvite ? 'bg-brand-500' : 'bg-slate-200 dark:bg-slate-700')}
          >
            <span className={cn('pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform', editAllowInvite ? 'translate-x-5' : 'translate-x-0')} />
          </button>
        </div>
        <div className="flex justify-end border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button onClick={handleSaveSettings} isLoading={savingEdit} size="sm" className="gap-1.5">
            <Save className="h-3.5 w-3.5" /> Save settings
          </Button>
        </div>
      </div>

      {/* Custom Roles */}
      <div className="card">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/10">
            <Shield className="h-5 w-5 text-brand-500" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Custom roles</h3>
        </div>
        <RolesManager teamId={activeTeam._id} isAdmin={isAdmin} />
      </div>

      {/* AI & API Keys */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/10">
            <Bot className="h-5 w-5 text-brand-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">AI &amp; API keys</h3>
            <p className="text-xs text-slate-400">Encrypted at rest and never exposed.</p>
          </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Add your OpenAI API key to enable AI chatbots for this team.
        </p>

        {/* Current key status */}
        {!apiKeyLoaded ? (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <div className="h-3 w-3 animate-spin rounded-full border border-slate-400 border-t-transparent" /> Loading…
          </div>
        ) : apiKeyData ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800/40 dark:bg-emerald-500/10">
            <div className="flex items-center gap-2.5 min-w-0">
              <KeyRound className="h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 truncate">{apiKeyData.label || 'OpenAI API Key'}</p>
                <p className="font-mono text-xs text-emerald-600 dark:text-emerald-400">{apiKeyData.keyHint}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">{apiKeyData.model}</span>
              <button
                onClick={handleDeleteApiKey}
                disabled={deletingApiKey}
                className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
                title="Remove API key"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-500" />
            <p className="text-sm text-slate-500 dark:text-slate-400">No API key configured — chatbots won't work.</p>
          </div>
        )}

        {/* Set / Replace key form */}
        <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">{apiKeyData ? 'Replace API key' : 'Add API key'}</label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                placeholder="sk-..."
                value={apiKeyInput}
                onChange={(e) => { setApiKeyInput(e.target.value); setApiKeyError(''); }}
                className={cn(fieldClass, 'pl-9')}
              />
            </div>
            {apiKeyError && <p className="mt-1 text-xs text-red-500">{apiKeyError}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">Label (optional)</label>
              <input
                type="text"
                placeholder="e.g. Production key"
                value={apiKeyLabel}
                onChange={(e) => setApiKeyLabel(e.target.value)}
                className={cn(fieldClass, 'placeholder:text-slate-400')}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">Default model</label>
              <div className="relative">
                <select
                  value={apiKeyModel}
                  onChange={(e) => setApiKeyModel(e.target.value)}
                  className={cn(fieldClass, 'appearance-none pr-8')}
                >
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveApiKey} isLoading={savingApiKey} disabled={!apiKeyInput.trim()} size="sm" className="gap-1.5">
              <Save className="h-3.5 w-3.5" /> {apiKeyData ? 'Replace key' : 'Save key'}
            </Button>
          </div>
        </div>
      </div>

      {/* Labels */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/10">
            <Tag className="h-5 w-5 text-brand-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Labels</h3>
            <p className="text-xs text-slate-400">Categorize tasks with colored tags.</p>
          </div>
        </div>
        {!labelsLoaded ? (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <div className="h-3 w-3 animate-spin rounded-full border border-slate-400 border-t-transparent" /> Loading…
          </div>
        ) : (
          <div className="space-y-2">
            {labels.length === 0 && <p className="text-xs text-slate-400">No labels yet. Add one below.</p>}
            {labels.map((label) => (
              <div key={label._id} className="group flex items-center gap-2.5 rounded-xl border border-slate-100 px-3 py-2 transition-colors hover:border-slate-200 hover:bg-slate-50/60 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800/40">
                <span className="h-3.5 w-3.5 flex-shrink-0 rounded-full ring-2 ring-white dark:ring-slate-900" style={{ backgroundColor: label.color }} />
                {editingLabelId === label._id ? (
                  <input
                    autoFocus
                    value={editLabelName}
                    onChange={(e) => setEditLabelName(e.target.value)}
                    onBlur={async () => {
                      if (editLabelName.trim() && editLabelName !== label.name) {
                        const updated = await labelService.updateLabel(activeTeam._id, label._id, { name: editLabelName.trim() });
                        setLabels(updated);
                      }
                      setEditingLabelId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      if (e.key === 'Escape') setEditingLabelId(null);
                    }}
                    className="flex-1 rounded border border-brand-300 bg-transparent px-2 py-0.5 text-sm text-slate-800 focus:outline-none dark:text-slate-100"
                  />
                ) : (
                  <span
                    className="flex-1 cursor-pointer text-sm text-slate-700 dark:text-slate-300"
                    onClick={() => { setEditingLabelId(label._id); setEditLabelName(label.name); }}
                  >
                    {label.name}
                  </span>
                )}
                <button
                  onClick={async () => {
                    const updated = await labelService.deleteLabel(activeTeam._id, label._id);
                    setLabels(updated);
                  }}
                  className="rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-slate-600 dark:hover:bg-red-500/10 dark:hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                  title="Delete label"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {/* Add label form */}
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 px-3 py-2 dark:border-slate-700">
              <div className="flex gap-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewLabelColor(c)}
                    className="h-4 w-4 rounded-full transition-transform hover:scale-110"
                    style={{ backgroundColor: c, outline: newLabelColor === c ? `2px solid ${c}` : 'none', outlineOffset: 2 }}
                  />
                ))}
              </div>
              <input
                type="text"
                placeholder="Label name…"
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && newLabelName.trim()) {
                    setAddingLabel(true);
                    try {
                      const updated = await labelService.addLabel(activeTeam._id, newLabelName.trim(), newLabelColor);
                      setLabels(updated);
                      setNewLabelName('');
                    } finally { setAddingLabel(false); }
                  }
                }}
                className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
              />
              <button
                onClick={async () => {
                  if (!newLabelName.trim()) return;
                  setAddingLabel(true);
                  try {
                    const updated = await labelService.addLabel(activeTeam._id, newLabelName.trim(), newLabelColor);
                    setLabels(updated);
                    setNewLabelName('');
                  } finally { setAddingLabel(false); }
                }}
                disabled={!newLabelName.trim() || addingLabel}
                className="rounded-lg bg-brand-500 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div className="card border-red-200 bg-red-50/40 dark:border-red-900/40 dark:bg-red-500/[0.04]">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-100 dark:bg-red-500/15">
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </div>
          <h3 className="text-sm font-semibold text-red-600 dark:text-red-400">Danger zone</h3>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-xl border border-red-100 bg-white px-4 py-3 dark:border-red-900/40 dark:bg-slate-900">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Archive team</p>
            <p className="text-xs text-slate-400">Hides the team from all members. Cannot be undone easily.</p>
          </div>
          <button
            disabled
            title="Feature coming in a future update"
            className="flex-shrink-0 cursor-not-allowed rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-400 opacity-60 dark:border-red-800"
          >
            Archive team
          </button>
        </div>
      </div>
    </div>
  );
};
