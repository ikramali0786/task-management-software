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
      <div className="rounded-xl border border-slate-200 py-12 text-center dark:border-slate-700">
        <Settings className="mx-auto mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
        <p className="text-sm text-slate-400">Only admins can access team settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Team info */}
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Edit2 className="h-4 w-4 text-brand-500" /> Team Info
        </h3>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-500">Team Name</label>
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-500">Description</label>
          <textarea
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-500">Default Task Priority</label>
          <div className="relative">
            <select
              value={editPriority}
              onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
              className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 pr-8 text-sm text-slate-800 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Allow Member Invites</p>
            <p className="text-xs text-slate-400">Non-admins can generate invite codes</p>
          </div>
          <button
            type="button"
            onClick={() => setEditAllowInvite((v) => !v)}
            className={cn('relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors', editAllowInvite ? 'bg-brand-500' : 'bg-slate-200 dark:bg-slate-700')}
          >
            <span className={cn('pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform', editAllowInvite ? 'translate-x-5' : 'translate-x-0')} />
          </button>
        </div>
        <div>
          <Button onClick={handleSaveSettings} isLoading={savingEdit} size="sm" className="gap-1.5">
            <Save className="h-3.5 w-3.5" /> Save Settings
          </Button>
        </div>
      </div>

      {/* Custom Roles */}
      <div className="card">
        <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Shield className="h-4 w-4 text-brand-500" /> Custom Roles
        </h3>
        <RolesManager teamId={activeTeam._id} isAdmin={isAdmin} />
      </div>

      {/* AI & API Keys */}
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Bot className="h-4 w-4 text-brand-500" /> AI &amp; API Keys
        </h3>
        <p className="text-xs text-slate-500">
          Add your OpenAI API key to enable AI chatbots for this team. The key is encrypted at rest and never exposed.
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
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">{apiKeyData ? 'Replace API Key' : 'Add API Key'}</label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                placeholder="sk-..."
                value={apiKeyInput}
                onChange={(e) => { setApiKeyInput(e.target.value); setApiKeyError(''); }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm text-slate-800 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
            {apiKeyError && <p className="mt-1 text-xs text-red-500">{apiKeyError}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Label (optional)</label>
              <input
                type="text"
                placeholder="e.g. Production Key"
                value={apiKeyLabel}
                onChange={(e) => setApiKeyLabel(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Default Model</label>
              <div className="relative">
                <select
                  value={apiKeyModel}
                  onChange={(e) => setApiKeyModel(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 pr-8 text-sm text-slate-800 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
          </div>
          <Button onClick={handleSaveApiKey} isLoading={savingApiKey} disabled={!apiKeyInput.trim()} size="sm" className="gap-1.5">
            <Save className="h-3.5 w-3.5" /> {apiKeyData ? 'Replace Key' : 'Save Key'}
          </Button>
        </div>
      </div>

      {/* Labels */}
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Tag className="h-4 w-4 text-brand-500" /> Labels
        </h3>
        {!labelsLoaded ? (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <div className="h-3 w-3 animate-spin rounded-full border border-slate-400 border-t-transparent" /> Loading…
          </div>
        ) : (
          <div className="space-y-2">
            {labels.length === 0 && <p className="text-xs text-slate-400">No labels yet. Add one below.</p>}
            {labels.map((label) => (
              <div key={label._id} className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 dark:border-slate-800">
                <span className="h-4 w-4 flex-shrink-0 rounded-full" style={{ backgroundColor: label.color }} />
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
                  className="rounded p-1 text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-colors"
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
      <div className="card border border-red-100 dark:border-red-900/30">
        <h3 className="mb-3 text-sm font-semibold text-red-600 dark:text-red-400">Danger Zone</h3>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Archive Team</p>
            <p className="text-xs text-slate-400">Hides the team from all members. Cannot be undone easily.</p>
          </div>
          <button
            disabled
            title="Feature coming in a future update"
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-400 opacity-50 cursor-not-allowed dark:border-red-800"
          >
            Archive Team
          </button>
        </div>
      </div>
    </div>
  );
};
