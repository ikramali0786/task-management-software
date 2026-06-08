import { useEffect, useState } from 'react';
import {
  Share2, Plus, Trash2, Loader2, Copy, Check, ExternalLink, Power, LayoutGrid, FileInput, Code2,
} from 'lucide-react';
import { usePlan } from '@/hooks/usePlan';
import { useUIStore } from '@/store/uiStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { sharingService, type IntakeForm, type BoardShare } from '@/services/sharingService';

const origin = () => (typeof window !== 'undefined' ? window.location.origin : '');

const CopyBtn = ({ text, label = 'Copy link' }: { text: string; label?: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1600); }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : label}
    </button>
  );
};

export const SharingSettings = () => {
  const { team } = usePlan();
  const { addToast, showConfirm } = useUIStore();
  const teamId = team?._id;

  const [board, setBoard] = useState<BoardShare>({ enabled: false, token: null });
  const [forms, setForms] = useState<IntakeForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [boardBusy, setBoardBusy] = useState(false);

  // New form
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!teamId) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    Promise.all([sharingService.getBoard(teamId), sharingService.listForms(teamId)])
      .then(([b, f]) => { if (active) { setBoard(b); setForms(f); } })
      .catch(() => active && addToast({ type: 'error', title: 'Failed to load sharing settings' }))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [teamId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!team) return <div className="card text-sm text-slate-500 dark:text-slate-400">Select a team to manage sharing.</div>;
  if (loading) return <div className="card py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></div>;

  const boardUrl = board.token ? `${origin()}/b/${board.token}` : '';
  const embedCode = board.token ? `<iframe src="${boardUrl}" width="100%" height="640" style="border:0" title="TaskFlow board"></iframe>` : '';

  const toggleBoard = async () => {
    if (!teamId) return;
    setBoardBusy(true);
    try {
      setBoard(board.enabled ? await sharingService.disableBoard(teamId) : await sharingService.enableBoard(teamId));
    } catch {
      addToast({ type: 'error', title: 'Could not update public board' });
    } finally {
      setBoardBusy(false);
    }
  };

  const createForm = async () => {
    if (!teamId || !title.trim()) return;
    setCreating(true);
    try {
      const form = await sharingService.createForm(teamId, { title: title.trim() });
      setForms((p) => [form, ...p]);
      setTitle('');
      addToast({ type: 'success', title: 'Intake form created' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Could not create form', message: err?.response?.data?.message });
    } finally {
      setCreating(false);
    }
  };

  const toggleForm = async (form: IntakeForm) => {
    try {
      const updated = await sharingService.updateForm(form.id, { enabled: !form.enabled });
      setForms((p) => p.map((f) => (f.id === form.id ? updated : f)));
    } catch {
      addToast({ type: 'error', title: 'Could not update form' });
    }
  };

  const removeForm = async (form: IntakeForm) => {
    const ok = await showConfirm({
      title: `Delete “${form.title}”?`,
      message: 'The public link will stop working. Existing tasks are kept.',
      confirmLabel: 'Delete', variant: 'danger',
    });
    if (!ok) return;
    try {
      await sharingService.deleteForm(form.id);
      setForms((p) => p.filter((f) => f.id !== form.id));
    } catch {
      addToast({ type: 'error', title: 'Could not delete form' });
    }
  };

  return (
    <div className="space-y-5">
      {/* Public board */}
      <div className="card">
        <div className="mb-1 flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-brand-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Public board</h3>
          {board.enabled && <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">Live</span>}
        </div>
        <p className="mb-4 text-xs text-slate-400">Share a read-only view of this team’s board with anyone, or embed it on a site.</p>

        {board.enabled && board.token ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/60">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Public link</span>
                <div className="flex items-center gap-1.5">
                  <CopyBtn text={boardUrl} />
                  <a href={boardUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"><ExternalLink className="h-3.5 w-3.5" /> Open</a>
                </div>
              </div>
              <code className="block break-all font-mono text-xs text-slate-600 dark:text-slate-300">{boardUrl}</code>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/60">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400"><Code2 className="h-3 w-3" /> Embed</span>
                <CopyBtn text={embedCode} label="Copy code" />
              </div>
              <code className="block break-all font-mono text-[11px] text-slate-500 dark:text-slate-400">{embedCode}</code>
            </div>
            <Button variant="secondary" onClick={toggleBoard} disabled={boardBusy} className="gap-1.5">
              {boardBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />} Disable public board
            </Button>
          </div>
        ) : (
          <Button onClick={toggleBoard} disabled={boardBusy} className="gap-1.5">
            {boardBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />} Enable public board
          </Button>
        )}
      </div>

      {/* Intake forms */}
      <div className="card">
        <div className="mb-1 flex items-center gap-2">
          <FileInput className="h-4 w-4 text-brand-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Intake forms</h3>
        </div>
        <p className="mb-4 text-xs text-slate-400">Public forms that turn submissions into tasks in this team.</p>

        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Form title (e.g. Bug report, Feature request)" className="flex-1" />
          <Button onClick={createForm} disabled={creating || !title.trim()} className="gap-1.5">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create
          </Button>
        </div>

        {forms.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">No intake forms yet.</p>
        ) : (
          <div className="space-y-2">
            {forms.map((f) => {
              const url = `${origin()}/f/${f.token}`;
              return (
                <div key={f.id} className={cn('rounded-xl border p-3', f.enabled ? 'border-slate-200 dark:border-slate-700' : 'border-slate-100 opacity-60 dark:border-slate-800')}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{f.title}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-400">/f/{f.token} · {f.submissionCount} submission{f.submissionCount === 1 ? '' : 's'}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <CopyBtn text={url} />
                      <a href={url} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800" title="Open"><ExternalLink className="h-4 w-4" /></a>
                      <button onClick={() => toggleForm(f)} className={cn('rounded-lg p-2 transition-colors', f.enabled ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800')} title={f.enabled ? 'Enabled' : 'Disabled'}><Power className="h-4 w-4" /></button>
                      <button onClick={() => removeForm(f)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
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
