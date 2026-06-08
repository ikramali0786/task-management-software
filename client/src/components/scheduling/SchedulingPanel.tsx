import { useEffect, useState } from 'react';
import { CalendarClock, Loader2, Check, Hash, Sparkles } from 'lucide-react';
import { taskService } from '@/services/taskService';
import { useTaskStore } from '@/store/taskStore';
import { useUIStore } from '@/store/uiStore';
import { formatDate } from '@/lib/utils';

type Suggestion = Awaited<ReturnType<typeof taskService.getSchedulingSuggestions>>[number];

const PRIORITY_DOT: Record<string, string> = { urgent: '#ef4444', high: '#f97316', medium: '#e8502e', low: '#a89f8f' };

export const SchedulingPanel = ({ teamId }: { teamId: string }) => {
  const { applySocketUpdate } = useTaskStore();
  const { addToast } = useUIStore();
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [applyingAll, setApplyingAll] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    taskService.getSchedulingSuggestions(teamId)
      .then((s) => active && setItems(s))
      .catch(() => active && setItems([]))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [teamId]);

  const apply = async (s: Suggestion) => {
    setBusy(s.taskId);
    try {
      await taskService.updateTask(s.taskId, { dueDate: s.suggestedDate });
      applySocketUpdate(s.taskId, { dueDate: s.suggestedDate } as any);
      setItems((p) => p.filter((x) => x.taskId !== s.taskId));
    } catch {
      addToast({ type: 'error', title: 'Could not set due date' });
    } finally {
      setBusy(null);
    }
  };

  const applyAll = async () => {
    setApplyingAll(true);
    try {
      for (const s of items) {
        await taskService.updateTask(s.taskId, { dueDate: s.suggestedDate });
        applySocketUpdate(s.taskId, { dueDate: s.suggestedDate } as any);
      }
      addToast({ type: 'success', title: `Scheduled ${items.length} task${items.length === 1 ? '' : 's'}` });
      setItems([]);
    } catch {
      addToast({ type: 'error', title: 'Some tasks could not be scheduled' });
    } finally {
      setApplyingAll(false);
    }
  };

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <div className="card">
      <div className="mb-1 flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-brand-500" />
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Smart scheduling</h3>
        <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-400">{items.length}</span>
        <button
          onClick={applyAll}
          disabled={applyingAll}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
        >
          {applyingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Schedule all
        </button>
      </div>
      <p className="mb-3 text-xs text-slate-400">Open tasks with no due date — suggested dates are based on priority.</p>

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {items.slice(0, 12).map((s) => (
          <div key={s.taskId} className="flex items-center gap-3 py-2.5">
            <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: PRIORITY_DOT[s.priority] }} />
            {s.identifier != null && (
              <span className="flex flex-shrink-0 items-center gap-0.5 font-mono text-[10px] text-slate-400"><Hash className="h-2.5 w-2.5" />{s.identifier}</span>
            )}
            <span className="min-w-0 flex-1 truncate text-sm text-slate-800 dark:text-slate-200">{s.title}</span>
            <span className="hidden flex-shrink-0 text-xs text-slate-400 sm:inline">Suggest {formatDate(s.suggestedDate)}</span>
            <button
              onClick={() => apply(s)}
              disabled={busy === s.taskId}
              className="inline-flex flex-shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-brand-300 hover:text-brand-600 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300"
            >
              {busy === s.taskId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Apply
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
