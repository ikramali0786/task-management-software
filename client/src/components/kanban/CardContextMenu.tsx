import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Archive, Trash2, UserCheck, UserMinus } from 'lucide-react';
import { Task, TaskStatus, TaskPriority, TASK_STATUSES, PRIORITY_CONFIG } from '@/types';
import { useTaskStore } from '@/store/taskStore';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { taskService } from '@/services/taskService';
import api from '@/services/api';
import { cn } from '@/lib/utils';

interface Props {
  task: Task;
  x: number;
  y: number;
  onClose: () => void;
}

export const CardContextMenu = ({ task, x, y, onClose }: Props) => {
  const { user } = useAuthStore();
  const { updateTask, applySocketUpdate, applySocketDelete } = useTaskStore();
  const { addToast } = useUIStore();
  const menuRef = useRef<HTMLDivElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loading, setLoading] = useState(false);

  // Auto-flip if near screen edge
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const MENU_W = 220;
  const MENU_H = 340;
  const posX = x + MENU_W > vw ? x - MENU_W : x;
  const posY = y + MENU_H > vh ? y - MENU_H : y;

  const isAssignee = user ? task.assignees?.some((a) => a._id === user._id) : false;

  // Close on outside click / Escape / scroll
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleScroll = () => onClose();

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  const handleStatusChange = async (status: TaskStatus) => {
    onClose();
    try {
      await taskService.updateTask(task._id, { status });
      applySocketUpdate(task._id, { status });
    } catch {
      addToast({ type: 'error', title: 'Failed to update status' });
    }
  };

  const handlePriorityChange = async (priority: TaskPriority) => {
    onClose();
    try {
      await taskService.updateTask(task._id, { priority });
      applySocketUpdate(task._id, { priority });
    } catch {
      addToast({ type: 'error', title: 'Failed to update priority' });
    }
  };

  const handleAssignToggle = async () => {
    if (!user) return;
    onClose();
    const current = task.assignees?.map((a) => a._id) ?? [];
    const updated = isAssignee
      ? current.filter((id) => id !== user._id)
      : [...current, user._id];
    try {
      await taskService.updateTask(task._id, { assignees: updated as any });
      applySocketUpdate(task._id, { assignees: updated as any });
      addToast({ type: 'success', title: isAssignee ? 'Unassigned from task' : 'Assigned to task' });
    } catch {
      addToast({ type: 'error', title: 'Failed to update assignees' });
    }
  };

  const handleDuplicate = async () => {
    onClose();
    const teamId = typeof task.team === 'string' ? task.team : (task.team as any)._id;
    try {
      await taskService.createTask({
        teamId,
        title: task.title + ' (copy)',
        description: task.description,
        status: task.status,
        priority: task.priority,
        labels: task.labels,
        dueDate: task.dueDate,
      });
      addToast({ type: 'success', title: 'Task duplicated' });
    } catch {
      addToast({ type: 'error', title: 'Failed to duplicate task' });
    }
  };

  const handleArchive = async () => {
    onClose();
    try {
      await api.patch(`/tasks/${task._id}`, { isArchived: true });
      applySocketDelete(task._id);
      addToast({ type: 'success', title: 'Task archived' });
    } catch {
      addToast({ type: 'error', title: 'Failed to archive task' });
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setLoading(true);
    onClose();
    try {
      await taskService.deleteTask(task._id);
      applySocketDelete(task._id);
      addToast({ type: 'success', title: 'Task deleted' });
    } catch {
      addToast({ type: 'error', title: 'Failed to delete task' });
    } finally {
      setLoading(false);
    }
  };

  const menu = (
    <div
      ref={menuRef}
      style={{ position: 'fixed', left: posX, top: posY, zIndex: 9999, width: MENU_W }}
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Move to */}
      <div className="px-3 pt-3 pb-2">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Move to</p>
        <div className="flex flex-wrap gap-1">
          {TASK_STATUSES.map(({ id, label, color }) => (
            <button
              key={id}
              onClick={() => handleStatusChange(id)}
              className={cn(
                'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-all',
                task.status === id
                  ? 'text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              )}
              style={task.status === id ? { backgroundColor: color } : {}}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: task.status === id ? 'rgba(255,255,255,0.7)' : color }} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Priority */}
      <div className="border-t border-slate-100 px-3 pt-2 pb-2 dark:border-slate-800">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Priority</p>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(PRIORITY_CONFIG) as TaskPriority[]).map((p) => {
            const cfg = PRIORITY_CONFIG[p];
            return (
              <button
                key={p}
                onClick={() => handlePriorityChange(p)}
                className={cn(
                  'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-all',
                  task.priority === p
                    ? 'text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                )}
                style={task.priority === p ? { backgroundColor: cfg.color } : {}}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: task.priority === p ? 'rgba(255,255,255,0.7)' : cfg.color }} />
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-100 dark:border-slate-800" />

      {/* Assign / Unassign */}
      <button
        onClick={handleAssignToggle}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        {isAssignee ? (
          <><UserMinus className="h-3.5 w-3.5 text-slate-400" /> Unassign me</>
        ) : (
          <><UserCheck className="h-3.5 w-3.5 text-slate-400" /> Assign to me</>
        )}
      </button>

      {/* Duplicate */}
      <button
        onClick={handleDuplicate}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Copy className="h-3.5 w-3.5 text-slate-400" />
        Duplicate
      </button>

      {/* Divider */}
      <div className="border-t border-slate-100 dark:border-slate-800" />

      {/* Archive */}
      <button
        onClick={handleArchive}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Archive className="h-3.5 w-3.5 text-slate-400" />
        Archive
      </button>

      {/* Delete */}
      <button
        onClick={handleDelete}
        disabled={loading}
        className={cn(
          'flex w-full items-center gap-2.5 px-3 py-2 text-xs transition-colors',
          confirmDelete
            ? 'bg-red-50 font-semibold text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20'
            : 'text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10'
        )}
      >
        <Trash2 className="h-3.5 w-3.5" />
        {confirmDelete ? 'Really delete?' : 'Delete'}
      </button>
    </div>
  );

  return createPortal(menu, document.body);
};
