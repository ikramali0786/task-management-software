import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Calendar, Flag, Users, Trash2, CheckCircle2, Wifi,
} from 'lucide-react';
import { Task, TaskStatus, TaskPriority, TASK_STATUSES, PRIORITY_CONFIG, User } from '@/types';
import { taskService } from '@/services/taskService';
import { useTaskStore } from '@/store/taskStore';
import { useTeamStore } from '@/store/teamStore';
import { useUIStore } from '@/store/uiStore';
import { Avatar } from '@/components/ui/Avatar';
import { cn, formatRelative } from '@/lib/utils';
import { getSocket } from '@/lib/socket';
import { MentionInput, extractMentions } from '@/components/ui/MentionInput';
import { CommentSection } from '@/components/tasks/CommentSection';
import { EmojiReactionBar } from '@/components/ui/EmojiReactionBar';

interface TaskDetailModalProps {
  taskId: string;
  onClose: () => void;
}

export const TaskDetailModal = ({ taskId, onClose }: TaskDetailModalProps) => {
  const { tasks, updateTask, deleteTask } = useTaskStore();
  const { activeTeam } = useTeamStore();
  const { addToast } = useUIStore();

  const task = tasks[taskId];
  const [loading, setLoading] = useState(!task);
  const [fullTask, setFullTask] = useState<Task | null>(task || null);
  const [editTitle, setEditTitle] = useState(false);
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [descMentions, setDescMentions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [liveUpdated, setLiveUpdated] = useState(false);
  // Tracks whether the store-sync effect has run at least once (skip initial mount)
  const storeSyncMountedRef = useRef(false);

  // ── Body scroll lock + Escape key to close ────────────────────────────────
  // Locks background scroll while the panel is open and allows Escape to
  // dismiss — prevents the "frozen UI" state where the backdrop stays on screen.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!task) {
      setLoading(true);
      taskService
        .getTask(taskId)
        .then((t) => {
          setFullTask(t);
          setTitle(t.title);
          setDescription(t.description);
        })
        .finally(() => setLoading(false));
    } else {
      setFullTask(task);
      setTitle(task.title);
      setDescription(task.description);
    }
  }, [taskId]);

  // ── Real-time socket sync ─────────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !fullTask) return;

    const handler = ({ taskId: id, changes }: { taskId: string; changes: Partial<Task> }) => {
      if (id !== taskId) return;
      setFullTask((prev) => (prev ? { ...prev, ...changes } : prev));
      if (changes.title !== undefined) setTitle(changes.title);
      if (changes.description !== undefined) setDescription(changes.description);
      setLiveUpdated(true);
      setTimeout(() => setLiveUpdated(false), 2000);
    };

    socket.on('task:updated', handler);
    return () => {
      socket.off('task:updated', handler);
    };
    // Re-subscribe when taskId or fullTask presence changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, !!fullTask]);

  // ── Sync from Zustand store ───────────────────────────────────────────────
  // useSocketEvents keeps tasks[taskId] current for ALL event types (task:updated
  // AND task:moved from Kanban drag-and-drop). Mirror scalar fields into fullTask
  // so the panel reflects teammate changes even when the local socket handler above
  // misses task:moved events (which never emit task:updated).
  useEffect(() => {
    if (!task) return;
    // Skip the very first run on mount — only react to subsequent store changes
    if (!storeSyncMountedRef.current) {
      storeSyncMountedRef.current = true;
      return;
    }
    setFullTask((prev) => {
      if (!prev) return prev;
      // Only update if something actually changed (avoids pointless re-renders)
      if (
        prev.status === task.status &&
        prev.priority === task.priority &&
        prev.dueDate === task.dueDate &&
        prev.completedAt === task.completedAt
      ) return prev;
      return {
        ...prev,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        completedAt: task.completedAt,
      };
    });
    setLiveUpdated(true);
    setTimeout(() => setLiveUpdated(false), 2000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.status, task?.priority, task?.dueDate, task?.completedAt]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSave = async (changes: Partial<Task>) => {
    setSaving(true);

    // Optimistic update: immediately apply primitive/safe field changes to local state
    // (excludes assignees which need populated User objects — those update via socket)
    const SAFE_FIELDS: (keyof Task)[] = ['title', 'description', 'status', 'priority', 'dueDate', 'labels', 'completedAt'];
    const optimistic: Partial<Task> = {};
    for (const key of SAFE_FIELDS) {
      if (key in changes) (optimistic as any)[key] = (changes as any)[key];
    }
    if (Object.keys(optimistic).length > 0) {
      setFullTask((prev) => (prev ? { ...prev, ...optimistic } : prev));
    }

    try {
      await updateTask(taskId, changes);
    } catch {
      // Revert optimistic update on error
      setFullTask((prev) => prev);
      addToast({ type: 'error', title: 'Failed to update task' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this task? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await deleteTask(taskId);
      addToast({ type: 'success', title: 'Task deleted' });
      onClose();
    } catch {
      addToast({ type: 'error', title: 'Failed to delete task' });
      setDeleting(false);
    }
  };

  const handleDescBlur = () => {
    if (!fullTask || description === fullTask.description) return;
    // Auto-assign newly mentioned users
    const currentAssigneeIds = fullTask.assignees.map((a) => a._id);
    const newMentioned = descMentions.filter((id) => !currentAssigneeIds.includes(id));
    const changes: Partial<Task> = { description };
    if (newMentioned.length > 0) {
      changes.assignees = [...currentAssigneeIds, ...newMentioned] as any;
    }
    handleSave(changes);
  };

  const handleStatusChange = (status: TaskStatus) => handleSave({ status });
  const handlePriorityChange = (priority: TaskPriority) => handleSave({ priority });
  const handleAssigneeToggle = (userId: string) => {
    const current = (fullTask?.assignees || []).map((a) => a._id);
    const updated = current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId];
    handleSave({ assignees: updated as any });
  };

  // Team members as User[]
  const teamMembers: User[] = activeTeam?.members.map((m) => m.user) || [];

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (!fullTask && loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-end">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/50"
        />
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 350, damping: 35 }}
          className="relative z-10 flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="flex h-full items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        </motion.div>
      </div>
    );
  }

  if (!fullTask) return null;

  const assigneeIds = fullTask.assignees.map((a) => a._id);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 350, damping: 35 }}
        className="relative z-10 flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex-1" />

          {/* Live badge */}
          <AnimatePresence>
            {liveUpdated && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 dark:bg-emerald-500/10"
              >
                <Wifi className="h-3 w-3 text-emerald-500" />
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  Live
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {saving && <span className="text-xs text-slate-400">Saving…</span>}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
            title="Delete task"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* Title */}
          {editTitle ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => {
                  setEditTitle(false);
                  if (title !== fullTask.title) handleSave({ title });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { setEditTitle(false); handleSave({ title }); }
                  if (e.key === 'Escape') { setEditTitle(false); setTitle(fullTask.title); }
                }}
                className="flex-1 rounded-xl border border-brand-400 bg-transparent px-3 py-2 text-lg font-bold text-slate-900 focus:outline-none dark:text-white"
              />
            </div>
          ) : (
            <h2
              onClick={() => setEditTitle(true)}
              className="cursor-pointer text-xl font-bold leading-relaxed text-slate-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400"
            >
              {fullTask.title}
            </h2>
          )}

          {/* Emoji Reactions */}
          <EmojiReactionBar
            resourceId={fullTask._id}
            resourceType="task"
            teamId={typeof fullTask.team === 'string' ? fullTask.team : fullTask.team._id}
            size="sm"
          />

          {/* Description with @mention support */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400">
              Description
            </label>
            <MentionInput
              value={description}
              onChange={setDescription}
              onMentionsChange={setDescMentions}
              members={teamMembers}
              placeholder="Add a description… use @ to mention teammates"
              rows={4}
              onBlur={handleDescBlur}
            />
          </div>

          {/* Status */}
          <div>
            <label className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> Status
            </label>
            <div className="flex flex-wrap gap-2">
              {TASK_STATUSES.map(({ id, label, color }) => (
                <button
                  key={id}
                  onClick={() => handleStatusChange(id)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
                    fullTask.status === id
                      ? 'border-transparent text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:border-slate-600'
                  )}
                  style={fullTask.status === id ? { backgroundColor: color } : {}}
                >
                  <div
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: fullTask.status === id ? 'rgba(255,255,255,0.6)' : color }}
                  />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-400">
              <Flag className="h-3.5 w-3.5" /> Priority
            </label>
            <div className="flex flex-wrap gap-2">
              {(['urgent', 'high', 'medium', 'low'] as TaskPriority[]).map((p) => {
                const config = PRIORITY_CONFIG[p];
                return (
                  <button
                    key={p}
                    onClick={() => handlePriorityChange(p)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
                      fullTask.priority === p
                        ? config.bg + ' border-transparent'
                        : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    )}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: config.color }} />
                    {config.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-400">
              <Calendar className="h-3.5 w-3.5" /> Due Date
            </label>
            <input
              type="date"
              value={fullTask.dueDate ? fullTask.dueDate.slice(0, 10) : ''}
              onChange={(e) => handleSave({ dueDate: e.target.value || null } as any)}
              className="input-field max-w-[200px]"
            />
          </div>

          {/* Assignees */}
          {activeTeam && (
            <div>
              <label className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-400">
                <Users className="h-3.5 w-3.5" /> Assignees
              </label>
              <div className="space-y-2">
                {activeTeam.members.map((m) => (
                  <button
                    key={m.user._id}
                    onClick={() => handleAssigneeToggle(m.user._id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-all',
                      assigneeIds.includes(m.user._id)
                        ? 'border-brand-200 bg-brand-50 dark:border-brand-800 dark:bg-brand-500/10'
                        : 'border-slate-100 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700'
                    )}
                  >
                    <Avatar name={m.user.name} src={m.user.avatar} size="sm" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{m.user.name}</p>
                      <p className="text-xs text-slate-400">{m.role}</p>
                    </div>
                    {assigneeIds.includes(m.user._id) && (
                      <CheckCircle2 className="h-4 w-4 text-brand-500" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Meta */}
          <div className="space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Created by</span>
              <div className="flex items-center gap-1.5">
                <Avatar name={fullTask.createdBy?.name || 'Unknown'} src={fullTask.createdBy?.avatar} size="xs" />
                <span>{fullTask.createdBy?.name}</span>
              </div>
            </div>
            {fullTask.createdAt && (
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Created</span>
                <span>{formatRelative(fullTask.createdAt)}</span>
              </div>
            )}
            {fullTask.completedAt && (
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Completed</span>
                <span>{formatRelative(fullTask.completedAt)}</span>
              </div>
            )}
          </div>

          {/* Comments */}
          {activeTeam && (
            <div className="border-t border-slate-100 pt-5 dark:border-slate-800">
              <CommentSection
                taskId={taskId}
                teamId={activeTeam._id}
                members={teamMembers}
              />
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
