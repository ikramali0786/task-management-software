import { useState, useRef } from 'react';
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
import { AnimatePresence } from 'framer-motion';
import { Task, TaskStatus, TASK_STATUSES } from '@/types';
import { useTaskStore } from '@/store/taskStore';
import { useUIStore } from '@/store/uiStore';
import { taskService } from '@/services/taskService';
import { getSocket } from '@/lib/socket';
import { KanbanColumn } from './KanbanColumn';
import { TaskCard } from './TaskCard';
import { TaskDetailModal } from '@/components/tasks/TaskDetailModal';

const getMidpoint = (a: number, b: number) => (a + b) / 2;

export const KanbanBoard = () => {
  const { tasks, columns, moveTask, rollbackMove } = useTaskStore();
  const { activeModal, activeTaskId, closeModal } = useUIStore();
  const { addToast } = useUIStore();

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const prevState = useRef<{ taskId: string; status: TaskStatus; position: number } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
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

    // Calculate new position
    const before = tasks[columnTaskIds[overIdx - 1]]?.position ?? 0;
    const after = tasks[columnTaskIds[overIdx]]?.position ?? before + 2000;
    const newPosition = overIdx === 0 ? (after / 2) : getMidpoint(before, after);

    // Optimistic update
    moveTask(activeId, newStatus, newPosition);

    // Persist
    try {
      await taskService.updatePosition(activeId, newPosition, newStatus);

      // Emit to socket for other clients
      const socket = getSocket();
      if (socket && task.team) {
        socket.emit('task:move', {
          taskId: activeId,
          newStatus,
          newPosition,
          teamId: typeof task.team === 'string' ? task.team : (task.team as any)._id,
        });
      }
    } catch {
      // Rollback
      const prev = prevState.current;
      rollbackMove(prev.taskId, prev.status, prev.position);
      addToast({ type: 'error', title: 'Failed to move task', message: 'Changes reverted.' });
    }

    prevState.current = null;
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
              taskIds={columns[id]}
              tasks={tasks}
            />
          ))}
        </div>

        {/* dropAnimation={null} → card snaps instantly to its new column (no post-drop delay) */}
        <DragOverlay dropAnimation={null}>
          {activeTask ? <TaskCard task={activeTask} isDragging /> : null}
        </DragOverlay>
      </DndContext>

      <AnimatePresence>
        {activeModal === 'task-detail' && activeTaskId && (
          <TaskDetailModal taskId={activeTaskId} onClose={closeModal} />
        )}
      </AnimatePresence>
    </>
  );
};
