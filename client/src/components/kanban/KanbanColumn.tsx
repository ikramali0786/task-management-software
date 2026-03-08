import { useState, useRef } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, X, Check } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { TaskStatus, Task, TASK_STATUSES } from '@/types';
import { SortableTaskCard } from './TaskCard';
import { useTaskStore } from '@/store/taskStore';
import { useTeamStore } from '@/store/teamStore';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';

const statusConfig = TASK_STATUSES.reduce((acc, s) => {
  acc[s.id] = s;
  return acc;
}, {} as Record<string, { id: string; label: string; color: string }>);

const emptyStates: Record<TaskStatus, { emoji: string; text: string }> = {
  todo: { emoji: '📋', text: 'No tasks yet — add one below' },
  in_progress: { emoji: '⚡', text: 'Nothing in progress' },
  review: { emoji: '🔍', text: 'No tasks awaiting review' },
  done: { emoji: '✅', text: 'Nothing completed yet' },
};

// ── WIP limit helpers ──────────────────────────────────────────────────────────
const readWipLimits = (teamId: string): Record<string, number | null> => {
  try { return JSON.parse(localStorage.getItem(`tf_wip_${teamId}`) || '{}'); }
  catch { return {}; }
};

const saveWipLimit = (teamId: string, status: TaskStatus, value: number | null) => {
  const limits = readWipLimits(teamId);
  if (value === null) { delete limits[status]; } else { limits[status] = value; }
  localStorage.setItem(`tf_wip_${teamId}`, JSON.stringify(limits));
};

interface KanbanColumnProps {
  status: TaskStatus;
  taskIds: string[];
  tasks: Record<string, Task>;
  selectionMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  teamId: string;
}

export const KanbanColumn = ({ status, taskIds, tasks, selectionMode, selectedIds, onToggleSelect, teamId }: KanbanColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { type: 'column', status } });
  const { createTask } = useTaskStore();
  const { activeTeam } = useTeamStore();
  const { addToast } = useUIStore();

  const [addingTask, setAddingTask] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // WIP limit state
  const [wipLimit, setWipLimit] = useState<number | null>(() => readWipLimits(teamId)[status] ?? null);
  const [editingWip, setEditingWip] = useState(false);
  const [wipInput, setWipInput] = useState('');
  const wipInputRef = useRef<HTMLInputElement>(null);

  const config = statusConfig[status];
  const empty = emptyStates[status];
  const columnTasks = taskIds.map((id) => tasks[id]).filter(Boolean);

  const isExceeded = wipLimit !== null && columnTasks.length > wipLimit;
  const isNear = wipLimit !== null && !isExceeded && columnTasks.length >= Math.ceil(wipLimit * 0.8);

  const handleAddTask = async () => {
    if (!newTitle.trim() || !activeTeam) return;
    setSubmitting(true);
    try {
      await createTask({ title: newTitle.trim(), teamId: activeTeam._id, status });
      setNewTitle('');
      setAddingTask(false);
      addToast({ type: 'success', title: 'Task created' });
    } catch {
      addToast({ type: 'error', title: 'Failed to create task' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleWipSave = () => {
    const val = parseInt(wipInput, 10);
    if (!wipInput.trim()) {
      saveWipLimit(teamId, status, null);
      setWipLimit(null);
    } else if (!isNaN(val) && val >= 1 && val <= 99) {
      saveWipLimit(teamId, status, val);
      setWipLimit(val);
    }
    setEditingWip(false);
    setWipInput('');
  };

  const handleWipClear = () => {
    saveWipLimit(teamId, status, null);
    setWipLimit(null);
    setEditingWip(false);
    setWipInput('');
  };

  const handleWipKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleWipSave();
    if (e.key === 'Escape') { setEditingWip(false); setWipInput(''); }
  };

  const openWipEdit = () => {
    setWipInput(wipLimit !== null ? String(wipLimit) : '');
    setEditingWip(true);
    setTimeout(() => wipInputRef.current?.focus(), 50);
  };

  // WIP badge colour
  const wipBadgeClass = isExceeded
    ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400 ring-1 ring-red-400/40'
    : isNear
      ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'
      : wipLimit !== null
        ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700';

  return (
    <div className="flex w-72 flex-shrink-0 flex-col">
      {/* Column header */}
      <div className="mb-3 flex items-center gap-2.5">
        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: config.color }} />
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{config.label}</h3>

        {/* WIP limit badge / editor */}
        <div className="ml-auto flex items-center gap-1">
          {editingWip ? (
            <div className="flex items-center gap-1">
              <input
                ref={wipInputRef}
                type="number"
                min={1}
                max={99}
                value={wipInput}
                onChange={(e) => setWipInput(e.target.value)}
                onKeyDown={handleWipKeyDown}
                onBlur={handleWipSave}
                placeholder="limit"
                className="w-14 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-center font-mono text-[10px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
              <button
                onMouseDown={(e) => { e.preventDefault(); handleWipSave(); }}
                className="rounded p-0.5 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
              >
                <Check className="h-3 w-3" />
              </button>
              {wipLimit !== null && (
                <button
                  onMouseDown={(e) => { e.preventDefault(); handleWipClear(); }}
                  className="rounded p-0.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                  title="Clear WIP limit"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={openWipEdit}
              title={wipLimit !== null ? `WIP limit: ${wipLimit} — click to change` : 'Click to set WIP limit'}
              className={cn('rounded-full px-2 py-0.5 text-xs font-medium transition-colors cursor-pointer', wipBadgeClass)}
            >
              {wipLimit !== null ? `${columnTasks.length} / ${wipLimit}` : columnTasks.length}
            </button>
          )}
        </div>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-col rounded-2xl p-2 transition-colors',
          isOver
            ? 'bg-brand-50 ring-2 ring-brand-400/40 dark:bg-brand-500/10'
            : isExceeded
              ? 'bg-red-50/60 ring-2 ring-red-400/30 dark:bg-red-500/5'
              : 'bg-slate-100/60 dark:bg-slate-800/40'
        )}
      >
        {/* Scrollable task list */}
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          <div
            className="overflow-y-auto pr-0.5"
            style={{ maxHeight: 'calc(100vh - 14rem)' }}
          >
            <div className="space-y-2.5 pb-0.5">
              <AnimatePresence>
                {columnTasks.map((task) => (
                  <SortableTaskCard
                    key={task._id}
                    task={task}
                    selectionMode={selectionMode}
                    isSelected={selectedIds.has(task._id)}
                    onToggleSelect={onToggleSelect}
                  />
                ))}
              </AnimatePresence>

              {/* Empty state */}
              {columnTasks.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-8 text-center dark:border-slate-700"
                >
                  <span className="mb-1.5 text-2xl">{empty.emoji}</span>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{empty.text}</p>
                </motion.div>
              )}
            </div>
          </div>
        </SortableContext>

        {/* Quick add — outside scroll area so it stays visible */}
        <AnimatePresence>
          {!selectionMode && (
            addingTask ? (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <textarea
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddTask(); }
                    if (e.key === 'Escape') { setAddingTask(false); setNewTitle(''); }
                  }}
                  placeholder="Task title..."
                  className="w-full resize-none bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
                  rows={2}
                />
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={handleAddTask}
                    disabled={!newTitle.trim() || submitting}
                    className="flex h-7 items-center gap-1 rounded-lg bg-brand-500 px-3 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                  >
                    <Check className="h-3 w-3" />
                    Add
                  </button>
                  <button
                    onClick={() => { setAddingTask(false); setNewTitle(''); }}
                    className="flex h-7 items-center gap-1 rounded-lg px-2 text-xs text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => setAddingTask(true)}
                className="mt-2.5 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-white hover:text-slate-600 dark:hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                Add task
              </motion.button>
            )
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
