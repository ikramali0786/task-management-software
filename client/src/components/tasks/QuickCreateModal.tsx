import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Sparkles, Trash2, Bookmark, Loader2, LayoutTemplate } from 'lucide-react';
import { useTaskStore } from '@/store/taskStore';
import { useTeamStore } from '@/store/teamStore';
import { useUIStore } from '@/store/uiStore';
import { TaskStatus, TaskPriority, TASK_STATUSES } from '@/types';
import { cn } from '@/lib/utils';
import { templateService, type TaskTemplate } from '@/services/templateService';
import { aiService } from '@/services/aiService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const PRIORITIES: { value: TaskPriority; label: string; dot: string }[] = [
  { value: 'urgent', label: 'Urgent', dot: 'bg-red-500' },
  { value: 'high', label: 'High', dot: 'bg-orange-500' },
  { value: 'medium', label: 'Medium', dot: 'bg-brand-500' },
  { value: 'low', label: 'Low', dot: 'bg-slate-400' },
];

export const QuickCreateModal = ({ isOpen, onClose }: Props) => {
  const { createTask } = useTaskStore();
  const { activeTeam } = useTeamStore();
  const { addToast, showConfirm } = useUIStore();
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Templates + AI quick-add
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [usingTpl, setUsingTpl] = useState<string | null>(null);
  const [savingTpl, setSavingTpl] = useState(false);
  // AI-parsed extras that the quick form has no field for — merged in on submit.
  const [extra, setExtra] = useState<{ description?: string; dueDate?: string | null }>({});

  // Reset & focus on open; load this team's templates.
  useEffect(() => {
    if (!isOpen) return;
    setTitle('');
    setStatus('todo');
    setPriority('medium');
    setExtra({});
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    if (activeTeam) {
      templateService.list(activeTeam._id).then(setTemplates).catch(() => setTemplates([]));
    }
    return () => cancelAnimationFrame(raf);
  }, [isOpen, activeTeam]);

  const handleSubmit = async () => {
    if (!title.trim() || !activeTeam || submitting) return;
    setSubmitting(true);
    try {
      await createTask({
        title: title.trim(),
        teamId: activeTeam._id,
        status,
        priority,
        ...(extra.description ? { description: extra.description } : {}),
        ...(extra.dueDate ? { dueDate: extra.dueDate } : {}),
      });
      addToast({ type: 'success', title: 'Task created' });
      onClose();
    } catch {
      addToast({ type: 'error', title: 'Failed to create task' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── AI quick-add: parse the typed text into fields ───────────────────────
  const handleAiParse = async () => {
    if (!activeTeam || !title.trim() || aiBusy) return;
    setAiBusy(true);
    try {
      const draft = await aiService.parseTask(activeTeam._id, title.trim());
      setTitle(draft.title);
      setPriority(draft.priority);
      setStatus(draft.status);
      setExtra({ description: draft.description, dueDate: draft.dueDate });
      addToast({
        type: 'success',
        title: 'AI filled the details',
        message: draft.dueDate ? `Due ${new Date(draft.dueDate).toLocaleDateString()}` : undefined,
      });
    } catch (err: any) {
      const code = err?.response?.data?.code;
      if (code !== 'PLAN_LIMIT') {
        addToast({
          type: 'error',
          title: "Couldn't parse that",
          message: code === 'NO_AI_KEY'
            ? 'Add an OpenAI key in Team Settings → AI & API.'
            : err?.response?.data?.message || 'Try rephrasing.',
        });
      }
    } finally {
      setAiBusy(false);
    }
  };

  // ── Templates ────────────────────────────────────────────────────────────
  const handleUseTemplate = async (tpl: TaskTemplate) => {
    if (!activeTeam || usingTpl) return;
    setUsingTpl(tpl.id);
    try {
      await templateService.use(tpl.id); // server creates the task; socket adds the card
      addToast({ type: 'success', title: `Created from “${tpl.name}”` });
      onClose();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Could not use template', message: err?.response?.data?.message });
    } finally {
      setUsingTpl(null);
    }
  };

  const handleSaveTemplate = async () => {
    if (!activeTeam || !title.trim() || savingTpl) return;
    setSavingTpl(true);
    try {
      const tpl = await templateService.create({
        teamId: activeTeam._id,
        name: title.trim().slice(0, 60),
        title: title.trim(),
        description: extra.description || '',
        priority,
        status,
      });
      setTemplates((prev) => [...prev, tpl].sort((a, b) => a.name.localeCompare(b.name)));
      addToast({ type: 'success', title: 'Saved as template' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Could not save template', message: err?.response?.data?.message });
    } finally {
      setSavingTpl(false);
    }
  };

  const handleDeleteTemplate = async (tpl: TaskTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await showConfirm({
      title: `Delete template “${tpl.name}”?`,
      message: 'This only removes the template, not any tasks created from it.',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await templateService.remove(tpl.id);
      setTemplates((prev) => prev.filter((t) => t.id !== tpl.id));
    } catch {
      addToast({ type: 'error', title: 'Could not delete template' });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          />

          {/* Modal */}
          <div className="fixed inset-x-0 top-28 z-50 mx-auto max-w-lg px-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -8 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 pointer-events-auto"
            >
              {/* Header */}
              <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg gradient-brand">
                  <Zap className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  New Task
                </span>
                <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 dark:border-slate-700 dark:bg-slate-800">
                  N
                </kbd>
                {activeTeam && (
                  <span className="ml-1 text-xs text-slate-400">
                    in <span className="font-medium text-slate-600 dark:text-slate-300">{activeTeam.name}</span>
                  </span>
                )}
                <button
                  aria-label="Close"
                  onClick={onClose}
                  className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-4 space-y-3">
                {/* Templates */}
                {templates.length > 0 && (
                  <div>
                    <p className="mb-1.5 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      <LayoutTemplate className="h-3 w-3" /> Start from a template
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {templates.map((tpl) => (
                        <button
                          key={tpl.id}
                          onClick={() => handleUseTemplate(tpl)}
                          disabled={usingTpl !== null}
                          className="group flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-brand-300 hover:text-brand-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-brand-500/50 dark:hover:text-brand-400"
                        >
                          {usingTpl === tpl.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <LayoutTemplate className="h-3 w-3" />}
                          {tpl.name}
                          <span
                            role="button"
                            tabIndex={-1}
                            onClick={(e) => handleDeleteTemplate(tpl, e)}
                            className="ml-0.5 rounded p-0.5 text-slate-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100 dark:text-slate-500"
                          >
                            <Trash2 className="h-3 w-3" />
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Title + AI quick-add */}
                <div>
                  <textarea
                    ref={inputRef}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Task title… or describe it and tap “AI fill”"
                    rows={2}
                    className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-brand-500 dark:focus:bg-slate-800/80"
                  />
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] text-slate-400">
                      Tip: “fix login bug tomorrow, urgent”
                    </span>
                    <button
                      onClick={handleAiParse}
                      disabled={aiBusy || !title.trim()}
                      className="inline-flex flex-shrink-0 items-center gap-1 rounded-lg border border-brand-200 px-2 py-1 text-[11px] font-semibold text-brand-600 transition-colors hover:bg-brand-50 disabled:opacity-50 dark:border-brand-500/40 dark:text-brand-400 dark:hover:bg-brand-500/10"
                    >
                      {aiBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      AI fill
                    </button>
                  </div>
                </div>

                {/* Status */}
                <div>
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">Status</p>
                  <div className="flex flex-wrap gap-1.5">
                    {TASK_STATUSES.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setStatus(s.id)}
                        className={cn(
                          'rounded-full px-2.5 py-1 text-xs font-medium transition-all',
                          status === s.id
                            ? 'text-white shadow-sm'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                        )}
                        style={status === s.id ? { backgroundColor: s.color } : undefined}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">Priority</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PRIORITIES.map((p) => (
                      <button
                        key={p.value}
                        onClick={() => setPriority(p.value)}
                        className={cn(
                          'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all',
                          priority === p.value
                            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', p.dot)} />
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submit */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    onClick={handleSaveTemplate}
                    disabled={!title.trim() || savingTpl}
                    title="Save the current title, status & priority as a reusable template"
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-400 transition-colors hover:text-brand-600 disabled:opacity-40 dark:hover:text-brand-400"
                  >
                    {savingTpl ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bookmark className="h-3 w-3" />}
                    Save as template
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={onClose}
                      className="rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:text-slate-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={!title.trim() || submitting || !activeTeam}
                      className="flex h-8 items-center gap-1.5 rounded-lg bg-brand-500 px-4 text-xs font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
                    >
                      {submitting ? 'Creating…' : 'Create task'}
                      {!submitting && (
                        <kbd className="rounded border border-brand-400/50 bg-brand-600/40 px-1 py-0.5 font-mono text-[9px]">
                          ↵
                        </kbd>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
