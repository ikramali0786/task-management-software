import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Check, Trash2, Pencil, X, ListChecks, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Subtask } from '@/types';
import { taskService } from '@/services/taskService';
import { cn } from '@/lib/utils';

interface SubtaskListProps {
  taskId: string;
  subtasks: Subtask[];
  onChange: (subtasks: Subtask[]) => void;
}

/* ── Single sortable subtask row ───────────────────────────────────────────── */
const SortableSubtaskRow = ({
  subtask,
  taskId,
  onUpdate,
  onDelete,
}: {
  subtask: Subtask;
  taskId: string;
  onUpdate: (subtasks: Subtask[]) => void;
  onDelete: (subtasks: Subtask[]) => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(subtask.title);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subtask._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleToggle = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const updated = await taskService.updateSubtask(taskId, subtask._id, {
        completed: !subtask.completed,
      });
      onUpdate(updated);
    } finally {
      setBusy(false);
    }
  }, [busy, taskId, subtask._id, subtask.completed, onUpdate]);

  const handleEditSave = useCallback(async () => {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === subtask.title) {
      setEditing(false);
      setEditValue(subtask.title);
      return;
    }
    setBusy(true);
    try {
      const updated = await taskService.updateSubtask(taskId, subtask._id, { title: trimmed });
      onUpdate(updated);
      setEditing(false);
    } catch {
      setEditValue(subtask.title);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }, [editValue, subtask.title, subtask._id, taskId, onUpdate]);

  const handleDelete = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const updated = await taskService.deleteSubtask(taskId, subtask._id);
      onDelete(updated);
    } finally {
      setBusy(false);
    }
  }, [busy, taskId, subtask._id, onDelete]);

  const startEdit = () => {
    setEditing(true);
    setEditValue(subtask.title);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors',
        isDragging
          ? 'z-50 shadow-md bg-white dark:bg-slate-800 opacity-90'
          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60',
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="mt-0.5 flex-shrink-0 cursor-grab touch-none rounded p-0.5 text-slate-200 opacity-0 transition-opacity group-hover:opacity-100 hover:text-slate-400 dark:text-slate-700 dark:hover:text-slate-500 active:cursor-grabbing"
        title="Drag to reorder"
        tabIndex={-1}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      {/* Animated checkbox */}
      <button
        onClick={handleToggle}
        disabled={busy}
        className={cn(
          'mt-0.5 flex flex-shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200',
          subtask.completed
            ? 'border-emerald-500 bg-emerald-500 text-white'
            : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800',
          busy && 'opacity-50',
        )}
        style={{ minWidth: '1.125rem', minHeight: '1.125rem', width: '1.125rem', height: '1.125rem' }}
        aria-label={subtask.completed ? 'Mark incomplete' : 'Mark complete'}
      >
        <AnimatePresence>
          {subtask.completed && (
            <motion.span
              key="check"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            >
              <Check className="h-2.5 w-2.5" strokeWidth={3} />
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Title / inline editor */}
      {editing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleEditSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleEditSave();
            if (e.key === 'Escape') { setEditing(false); setEditValue(subtask.title); }
          }}
          className="flex-1 rounded border border-brand-400 bg-white px-2 py-0.5 text-sm text-slate-800 focus:outline-none dark:border-brand-500 dark:bg-slate-800 dark:text-slate-100"
        />
      ) : (
        <span
          onClick={startEdit}
          title="Click to edit"
          className={cn(
            'flex-1 cursor-pointer select-none text-sm leading-relaxed transition-colors',
            subtask.completed
              ? 'text-slate-400 line-through dark:text-slate-500'
              : 'text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100',
          )}
        >
          {subtask.title}
        </span>
      )}

      {/* Action buttons — visible on hover */}
      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {!editing && (
          <button
            onClick={startEdit}
            className="rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-500 dark:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-400"
            title="Edit subtask"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
        {editing && (
          <button
            onClick={() => { setEditing(false); setEditValue(subtask.title); }}
            className="rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-500 dark:text-slate-600 dark:hover:bg-slate-700"
            title="Cancel edit"
          >
            <X className="h-3 w-3" />
          </button>
        )}
        <button
          onClick={handleDelete}
          disabled={busy}
          className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500 dark:text-slate-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
          title="Delete subtask"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};

/* ── SubtaskList ───────────────────────────────────────────────────────────── */
export const SubtaskList = ({ taskId, subtasks, onChange }: SubtaskListProps) => {
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);

  const total = subtasks.length;
  const done = subtasks.filter((s) => s.completed).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = subtasks.findIndex((s) => s._id === active.id);
      const newIndex = subtasks.findIndex((s) => s._id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      // Optimistic reorder
      const reordered = arrayMove(subtasks, oldIndex, newIndex);
      onChange(reordered);

      try {
        const updated = await taskService.reorderSubtasks(
          taskId,
          reordered.map((s) => s._id),
        );
        onChange(updated);
      } catch {
        // Revert on error
        onChange(subtasks);
      }
    },
    [subtasks, taskId, onChange],
  );

  const openAddRow = () => {
    setAdding(true);
    setNewTitle('');
    setTimeout(() => addInputRef.current?.focus(), 50);
  };

  const handleAdd = async () => {
    const trimmed = newTitle.trim();
    if (!trimmed) { setAdding(false); return; }

    const tempId = `temp-${Date.now()}`;
    const tempSubtask: Subtask = {
      _id: tempId,
      title: trimmed,
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onChange([...subtasks, tempSubtask]);
    setNewTitle('');
    setAdding(false);
    setAddBusy(true);

    try {
      const real = await taskService.addSubtask(taskId, trimmed);
      onChange(real);
    } catch {
      onChange(subtasks);
    } finally {
      setAddBusy(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <ListChecks className="h-3.5 w-3.5" />
          Subtasks
          {total > 0 && (
            <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-700 dark:text-slate-400">
              {done}/{total}
            </span>
          )}
        </label>
        <button
          onClick={openAddRow}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="mb-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
            <motion.div
              className="h-full rounded-full bg-emerald-500"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
          {pct === 100 && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-1.5 flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"
            >
              <Check className="h-3 w-3" strokeWidth={3} />
              All subtasks complete!
            </motion.p>
          )}
        </div>
      )}

      {/* Sortable subtask rows */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={subtasks.map((s) => s._id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-0.5">
            {subtasks.map((s) => (
              <SortableSubtaskRow
                key={s._id}
                subtask={s}
                taskId={taskId}
                onUpdate={onChange}
                onDelete={onChange}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add-new row */}
      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden mt-0.5"
          >
            <div className="flex items-center gap-2 rounded-lg border border-brand-300 bg-brand-50/50 px-2 py-1.5 dark:border-brand-700 dark:bg-brand-500/10">
              <div className="h-4 w-4 flex-shrink-0 rounded-md border-2 border-slate-300 dark:border-slate-600" />
              <input
                ref={addInputRef}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAdd();
                  if (e.key === 'Escape') { setAdding(false); setNewTitle(''); }
                }}
                onBlur={() => {
                  setTimeout(() => { if (!addBusy) { setAdding(false); setNewTitle(''); } }, 150);
                }}
                placeholder="Subtask title…"
                className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 focus:outline-none dark:text-slate-200"
              />
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleAdd}
                disabled={!newTitle.trim()}
                className="rounded-md bg-brand-500 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-40"
              >
                Add
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setAdding(false); setNewTitle(''); }}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {total === 0 && !adding && (
        <button
          onClick={openAddRow}
          className="mt-1 w-full rounded-lg border border-dashed border-slate-200 py-3 text-xs text-slate-400 transition-colors hover:border-brand-300 hover:text-brand-500 dark:border-slate-700 dark:hover:border-brand-700"
        >
          + Add your first subtask
        </button>
      )}
    </div>
  );
};
