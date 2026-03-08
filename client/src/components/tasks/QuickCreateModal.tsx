import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap } from 'lucide-react';
import { useTaskStore } from '@/store/taskStore';
import { useTeamStore } from '@/store/teamStore';
import { useUIStore } from '@/store/uiStore';
import { TaskStatus, TaskPriority, TASK_STATUSES } from '@/types';
import { cn } from '@/lib/utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const PRIORITIES: { value: TaskPriority; label: string; dot: string }[] = [
  { value: 'urgent', label: 'Urgent', dot: 'bg-red-500' },
  { value: 'high', label: 'High', dot: 'bg-orange-500' },
  { value: 'medium', label: 'Medium', dot: 'bg-indigo-500' },
  { value: 'low', label: 'Low', dot: 'bg-slate-400' },
];

export const QuickCreateModal = ({ isOpen, onClose }: Props) => {
  const { createTask } = useTaskStore();
  const { activeTeam } = useTeamStore();
  const { addToast } = useUIStore();
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Reset & focus on open
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setStatus('todo');
      setPriority('medium');
      const raf = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(raf);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!title.trim() || !activeTeam || submitting) return;
    setSubmitting(true);
    try {
      await createTask({ title: title.trim(), teamId: activeTeam._id, status, priority });
      addToast({ type: 'success', title: 'Task created' });
      onClose();
    } catch {
      addToast({ type: 'error', title: 'Failed to create task' });
    } finally {
      setSubmitting(false);
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
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          />

          {/* Modal */}
          <div className="fixed inset-x-0 top-28 z-50 mx-auto max-w-lg px-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
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
                  onClick={onClose}
                  className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-4 space-y-3">
                {/* Title */}
                <textarea
                  ref={inputRef}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Task title…"
                  rows={2}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-brand-500 dark:focus:bg-slate-800/80"
                />

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
                <div className="flex items-center justify-end gap-2 pt-1">
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
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
