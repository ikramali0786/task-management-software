import { useState } from 'react';
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

interface KanbanColumnProps {
  status: TaskStatus;
  taskIds: string[];
  tasks: Record<string, Task>;
  selectionMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
}

export const KanbanColumn = ({ status, taskIds, tasks, selectionMode, selectedIds, onToggleSelect }: KanbanColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { type: 'column', status } });
  const { createTask } = useTaskStore();
  const { activeTeam } = useTeamStore();
  const { addToast } = useUIStore();

  const [addingTask, setAddingTask] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const config = statusConfig[status];
  const columnTasks = taskIds.map((id) => tasks[id]).filter(Boolean);

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

  return (
    <div className="flex w-72 flex-shrink-0 flex-col">
      {/* Column header */}
      <div className="mb-3 flex items-center gap-2.5">
        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: config.color }} />
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{config.label}</h3>
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800">
          {columnTasks.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 rounded-2xl p-2 transition-colors min-h-[200px]',
          isOver
            ? 'bg-brand-50 ring-2 ring-brand-400/40 dark:bg-brand-500/10'
            : 'bg-slate-100/60 dark:bg-slate-800/40'
        )}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-2.5">
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
          </div>
        </SortableContext>

        {/* Quick add */}
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
