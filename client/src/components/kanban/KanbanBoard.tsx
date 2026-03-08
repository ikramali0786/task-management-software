import { useState, useRef, useCallback, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { AnimatePresence, motion } from 'framer-motion';
import { Trash2, ArrowRight, Archive, Flag, ChevronDown } from 'lucide-react';
import { Task, TaskStatus, TaskPriority, TASK_STATUSES, PRIORITY_CONFIG } from '@/types';
import { useTaskStore } from '@/store/taskStore';
import { useTeamStore } from '@/store/teamStore';
import { useUIStore } from '@/store/uiStore';
import { taskService } from '@/services/taskService';
import { getSocket } from '@/lib/socket';
import { KanbanColumn } from './KanbanColumn';
import { TaskCard } from './TaskCard';
import { TaskDetailModal } from '@/components/tasks/TaskDetailModal';
import { cn } from '@/lib/utils';
import api from '@/services/api';

const getMidpoint = (a: number, b: number) => (a + b) / 2;
const MIN_GAP = 0.001;

interface Props {
  /** When set, only tasks whose IDs are in this set are visible */
  filteredTaskIds?: Set<string> | null;
  /** Controlled from KanbanPage so the toolbar Select/Cancel button works */
  selectionMode: boolean;
  onExitSelection: () => void;
}

export const KanbanBoard = ({ filteredTaskIds, selectionMode, onExitSelection }: Props) => {
  const { tasks, columns, moveTask, rollbackMove, applySocketDelete, applySocketUpdate, activeTeamId } = useTaskStore();
  const { activeTeam } = useTeamStore();
  const { activeModal, activeTaskId, closeModal, addToast } = useUIStore();

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const prevState = useRef<{ taskId: string; status: TaskStatus; position: number } | null>(null);

  // ── Bulk selection ────────────────────────────────────────────────────────
  // selectionMode is controlled by the parent (KanbanPage) via the toolbar button.
  // selectedIds stays local since it's only used here.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [priorityMenuOpen, setPriorityMenuOpen] = useState(false);

  // Clear selection when parent turns selection mode off
  useEffect(() => {
    if (!selectionMode) setSelectedIds(new Set());
  }, [selectionMode]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const exitSelectionMode = () => {
    onExitSelection(); // parent flips selectionMode → false → useEffect clears selectedIds
  };

  const handleBulkMove = async (status: TaskStatus) => {
    if (!activeTeam || selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const ids = Array.from(selectedIds);
      await api.post('/tasks/bulk/update', { taskIds: ids, teamId: activeTeam._id, changes: { status } });
      ids.forEach((id) => applySocketUpdate(id, { status }));
      addToast({ type: 'success', title: `Moved ${ids.length} task${ids.length > 1 ? 's' : ''}` });
      exitSelectionMode();
    } catch {
      addToast({ type: 'error', title: 'Bulk move failed' });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!activeTeam || selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const ids = Array.from(selectedIds);
      await api.post('/tasks/bulk/delete', { taskIds: ids, teamId: activeTeam._id });
      ids.forEach((id) => applySocketDelete(id));
      addToast({ type: 'success', title: `Deleted ${ids.length} task${ids.length > 1 ? 's' : ''}` });
      exitSelectionMode();
    } catch {
      addToast({ type: 'error', title: 'Bulk delete failed' });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkPriority = async (priority: TaskPriority) => {
    if (!activeTeam || selectedIds.size === 0) return;
    setPriorityMenuOpen(false);
    setBulkLoading(true);
    try {
      const ids = Array.from(selectedIds);
      await api.post('/tasks/bulk/update', { taskIds: ids, teamId: activeTeam._id, changes: { priority } });
      ids.forEach((id) => applySocketUpdate(id, { priority }));
      addToast({ type: 'success', title: `Updated priority for ${ids.length} task${ids.length > 1 ? 's' : ''}` });
      exitSelectionMode();
    } catch {
      addToast({ type: 'error', title: 'Bulk priority update failed' });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkArchive = async () => {
    if (!activeTeam || selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const ids = Array.from(selectedIds);
      await api.post('/tasks/bulk/update', { taskIds: ids, teamId: activeTeam._id, changes: { isArchived: true } });
      ids.forEach((id) => applySocketDelete(id));
      addToast({ type: 'success', title: `Archived ${ids.length} task${ids.length > 1 ? 's' : ''}` });
      exitSelectionMode();
    } catch {
      addToast({ type: 'error', title: 'Bulk archive failed' });
    } finally {
      setBulkLoading(false);
    }
  };

  // ── DnD sensors ───────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    if (selectionMode) return;
    const task = tasks[event.active.id as string];
    if (task) {
      setActiveTask(task);
      prevState.current = { taskId: task._id, status: task.status, position: task.position };
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id as string;
    const overType = over.data.current?.type;
    const overStatus: TaskStatus = overType === 'column'
      ? over.data.current?.status
      : tasks[over.id as string]?.status;
    if (!overStatus || tasks[activeId]?.status === overStatus) return;
    moveTask(activeId, overStatus, tasks[activeId]?.position ?? 0);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    if (!over || !prevState.current) return;

    const activeId = active.id as string;
    const task = tasks[activeId];
    if (!task) return;

    const overType = over.data.current?.type;
    const newStatus: TaskStatus = overType === 'column'
      ? over.data.current?.status
      : tasks[over.id as string]?.status || task.status;

    const columnTaskIds = columns[newStatus].filter((id) => id !== activeId);
    const overIdx = overType === 'column' ? columnTaskIds.length : columnTaskIds.indexOf(over.id as string);

    const before = tasks[columnTaskIds[overIdx - 1]]?.position ?? 0;
    const after = tasks[columnTaskIds[overIdx]]?.position ?? before + 2000;
    const newPosition = overIdx === 0 ? (after / 2) : getMidpoint(before, after);

    moveTask(activeId, newStatus, newPosition);

    try {
      await taskService.updatePosition(activeId, newPosition, newStatus);

      // Trigger server rebalance when positions get too close
      if (after - before < MIN_GAP && activeTeamId) {
        api.post('/tasks/rebalance', { teamId: activeTeamId, status: newStatus }).catch(() => {});
      }

      const socket = getSocket();
      if (socket && task.team) {
        socket.emit('task:move', {
          taskId: activeId, newStatus, newPosition,
          teamId: typeof task.team === 'string' ? task.team : (task.team as any)._id,
        });
      }
    } catch {
      const prev = prevState.current;
      rollbackMove(prev.taskId, prev.status, prev.position);
      addToast({ type: 'error', title: 'Failed to move task', message: 'Changes reverted.' });
    }

    prevState.current = null;
  };

  const getColumnIds = (status: TaskStatus) => {
    if (!filteredTaskIds) return columns[status];
    return columns[status].filter((id) => filteredTaskIds.has(id));
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-5 p-6 h-full min-h-0">
          {TASK_STATUSES.map(({ id }) => (
            <KanbanColumn
              key={id}
              status={id}
              taskIds={getColumnIds(id)}
              tasks={tasks}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeTask ? <TaskCard task={activeTask} isDragging /> : null}
        </DragOverlay>
      </DndContext>

      {/* Bulk action bar */}
      <AnimatePresence>
        {selectionMode && selectedIds.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
          >
            <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-2xl dark:border-slate-700 dark:bg-slate-800">
              <span className="mr-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                {selectedIds.size} selected
              </span>
              {TASK_STATUSES.map(({ id, label, color }) => (
                <button
                  key={id}
                  onClick={() => handleBulkMove(id)}
                  disabled={bulkLoading}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-300"
                >
                  <ArrowRight className="h-3 w-3" />
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                  {label}
                </button>
              ))}

              <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-600" />

              {/* Priority dropdown */}
              <div className="relative">
                <button
                  onClick={() => setPriorityMenuOpen((v) => !v)}
                  disabled={bulkLoading}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-300"
                >
                  <Flag className="h-3 w-3" />
                  Priority
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </button>
                <AnimatePresence>
                  {priorityMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.12 }}
                      className="absolute bottom-full left-0 mb-2 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800"
                    >
                      {(Object.keys(PRIORITY_CONFIG) as TaskPriority[]).map((p) => {
                        const cfg = PRIORITY_CONFIG[p];
                        return (
                          <button
                            key={p}
                            onClick={() => handleBulkPriority(p)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
                          >
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                            {cfg.label}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Archive */}
              <button
                onClick={handleBulkArchive}
                disabled={bulkLoading}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-300"
              >
                <Archive className="h-3.5 w-3.5" />
                Archive
              </button>

              <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-600" />

              <button
                onClick={handleBulkDelete}
                disabled={bulkLoading}
                className={cn('flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-40')}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeModal === 'task-detail' && activeTaskId && !selectionMode && (
          <TaskDetailModal taskId={activeTaskId} onClose={closeModal} />
        )}
      </AnimatePresence>
    </>
  );
};
