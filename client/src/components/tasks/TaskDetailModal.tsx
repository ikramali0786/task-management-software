import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Calendar, Flag, Users, Trash2, CheckCircle2, Wifi,
  Paperclip, MessageSquare, AlertTriangle, Clock, Info,
} from 'lucide-react';
import { Task, TaskStatus, TaskPriority, Subtask, TASK_STATUSES, PRIORITY_CONFIG, User } from '@/types';
import { taskService } from '@/services/taskService';
import { useTaskStore } from '@/store/taskStore';
import { useTeamStore } from '@/store/teamStore';
import { useUIStore } from '@/store/uiStore';
import { Avatar } from '@/components/ui/Avatar';
import { cn, formatRelative } from '@/lib/utils';
import { getSocket } from '@/lib/socket';
import { MentionInput } from '@/components/ui/MentionInput';
import { CommentSection } from '@/components/tasks/CommentSection';
import { AttachmentPanel } from '@/components/tasks/AttachmentPanel';
import { EmojiReactionBar } from '@/components/ui/EmojiReactionBar';
import { SubtaskList } from '@/components/tasks/SubtaskList';

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
  const [localDueDate, setLocalDueDate] = useState<string>(
    task?.dueDate ? task.dueDate.slice(0, 10) : ''
  );
  const [subtasks, setSubtasks] = useState<Subtask[]>(task?.subtasks || []);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [liveUpdated, setLiveUpdated] = useState(false);
  const [activeTab, setActiveTab] = useState<'comments' | 'attachments'>('comments');
  const storeSyncMountedRef = useRef(false);

  // ── Body scroll lock + Escape key to close ────────────────────────────────
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmDelete) setConfirmDelete(false);
        else onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose, confirmDelete]);

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
          setSubtasks(t.subtasks || []);
        })
        .finally(() => setLoading(false));
    } else {
      setFullTask(task);
      setTitle(task.title);
      setDescription(task.description);
      setLocalDueDate(task.dueDate ? task.dueDate.slice(0, 10) : '');
      setSubtasks(task.subtasks || []);
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
      if (changes.dueDate !== undefined) setLocalDueDate(changes.dueDate ? changes.dueDate.slice(0, 10) : '');
      if (changes.subtasks !== undefined) setSubtasks(changes.subtasks);
      setLiveUpdated(true);
      setTimeout(() => setLiveUpdated(false), 2000);
    };

    socket.on('task:updated', handler);
    return () => { socket.off('task:updated', handler); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, !!fullTask]);

  // ── Sync from Zustand store ───────────────────────────────────────────────
  useEffect(() => {
    if (!task) return;
    if (!storeSyncMountedRef.current) { storeSyncMountedRef.current = true; return; }
    setFullTask((prev) => {
      if (!prev) return prev;
      if (
        prev.status === task.status && prev.priority === task.priority &&
        prev.dueDate === task.dueDate && prev.completedAt === task.completedAt
      ) return prev;
      return { ...prev, status: task.status, priority: task.priority, dueDate: task.dueDate, completedAt: task.completedAt };
    });
    setLiveUpdated(true);
    setTimeout(() => setLiveUpdated(false), 2000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.status, task?.priority, task?.dueDate, task?.completedAt]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSave = async (changes: Partial<Task>) => {
    setSaving(true);
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
      setFullTask((prev) => prev);
      addToast({ type: 'error', title: 'Failed to update task' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteTask(taskId);
      addToast({ type: 'success', title: 'Task deleted' });
      onClose();
    } catch {
      addToast({ type: 'error', title: 'Failed to delete task' });
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleDescBlur = () => {
    if (!fullTask || description === fullTask.description) return;
    const currentAssigneeIds = fullTask.assignees.map((a) => a._id);
    const newMentioned = descMentions.filter((id) => !currentAssigneeIds.includes(id));
    const changes: Partial<Task> = { description };
    if (newMentioned.length > 0) changes.assignees = [...currentAssigneeIds, ...newMentioned] as any;
    handleSave(changes);
  };

  const handleStatusChange = (status: TaskStatus) => handleSave({ status });
  const handlePriorityChange = (priority: TaskPriority) => handleSave({ priority });
  const handleAssigneeToggle = (userId: string) => {
    const current = (fullTask?.assignees || []).map((a) => a._id);
    const updated = current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId];
    handleSave({ assignees: updated as any });
  };

  const teamMembers: User[] = activeTeam?.members.map((m) => m.user) || [];

  const getDueDateStatus = () => {
    if (!fullTask?.dueDate || fullTask.status === 'done') return null;
    const due = new Date(fullTask.dueDate);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const diffDays = Math.round((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { label: `Overdue by ${Math.abs(diffDays)}d`, color: 'text-red-500' };
    if (diffDays === 0) return { label: 'Due today', color: 'text-amber-500' };
    if (diffDays <= 2) return { label: `Due in ${diffDays}d`, color: 'text-amber-400' };
    return null;
  };

  const dueDateStatus = fullTask ? getDueDateStatus() : null;
  const statusConfig = fullTask ? TASK_STATUSES.find((s) => s.id === fullTask.status) : null;
  const assigneeIds = fullTask?.assignees.map((a) => a._id) || [];

  // ── Loading state ──────────────────────────────────────────────────────────
  if (!fullTask && loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 350, damping: 35 }}
          className="relative z-10 flex h-64 w-full max-w-2xl items-center justify-center rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            <p className="text-sm text-slate-400">Loading task…</p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!fullTask) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ type: 'spring', stiffness: 350, damping: 35 }}
        className="relative z-10 flex w-[95vw] max-w-6xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Status accent line */}
        <div
          className="h-1 w-full flex-shrink-0 rounded-t-2xl transition-colors duration-300"
          style={{ backgroundColor: statusConfig?.color || '#94a3b8' }}
        />

        {/* Header bar */}
        <div className="flex flex-shrink-0 items-center gap-3 border-b border-slate-100 px-5 py-3 dark:border-slate-800">
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>

          {statusConfig && (
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
              style={{ backgroundColor: statusConfig.color }}
            >
              {statusConfig.label}
            </span>
          )}

          <div className="flex-1" />

          <AnimatePresence>
            {liveUpdated && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 dark:bg-emerald-500/10"
              >
                <Wifi className="h-3 w-3 text-emerald-500" />
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Live</span>
              </motion.div>
            )}
          </AnimatePresence>

          {saving && (
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <div className="h-3 w-3 animate-spin rounded-full border border-slate-400 border-t-transparent" />
              Saving…
            </span>
          )}

          <button
            onClick={() => setConfirmDelete(true)}
            disabled={deleting}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
            title="Delete task"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {/* Inline delete confirmation */}
        <AnimatePresence>
          {confirmDelete && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-shrink-0 overflow-hidden border-b border-red-100 bg-red-50 dark:border-red-900/30 dark:bg-red-500/10"
            >
              <div className="flex items-center gap-3 px-5 py-3">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-500" />
                <p className="flex-1 text-sm text-red-700 dark:text-red-400">
                  Delete this task? This <strong>cannot</strong> be undone.
                </p>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-60"
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── 2-column body ─────────────────────────────────────────────────── */}
        <div className="flex min-h-0 flex-1">

          {/* LEFT COLUMN — title, reactions, description, subtasks */}
          <div className="flex flex-1 flex-col overflow-y-auto border-r border-slate-100 dark:border-slate-800">
            <div className="space-y-5 p-6">

              {/* Title */}
              {editTitle ? (
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
                  className="w-full rounded-xl border border-brand-400 bg-transparent px-3 py-2 text-2xl font-bold text-slate-900 focus:outline-none dark:text-white"
                />
              ) : (
                <h2
                  onClick={() => setEditTitle(true)}
                  title="Click to edit title"
                  className="cursor-pointer text-2xl font-bold leading-snug text-slate-900 transition-colors hover:text-brand-600 dark:text-white dark:hover:text-brand-400"
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

              {/* Description */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
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

              {/* Subtasks */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-4 dark:border-slate-700/60 dark:bg-slate-800/40">
                <SubtaskList
                  taskId={taskId}
                  subtasks={subtasks}
                  onChange={setSubtasks}
                />
              </div>
            </div>

            {/* Tab bar + content (full width of left col, sticky at bottom) */}
            {activeTeam && (
              <div className="flex flex-col border-t border-slate-100 dark:border-slate-800">
                <div className="flex flex-shrink-0">
                  <button
                    onClick={() => setActiveTab('comments')}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                      activeTab === 'comments'
                        ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                        : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                    )}
                  >
                    <MessageSquare className="h-4 w-4" />
                    Comments
                  </button>
                  <button
                    onClick={() => setActiveTab('attachments')}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                      activeTab === 'attachments'
                        ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                        : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                    )}
                  >
                    <Paperclip className="h-4 w-4" />
                    Attachments
                  </button>
                </div>
                <div className="px-6 py-5">
                  <AnimatePresence mode="wait">
                    {activeTab === 'comments' ? (
                      <motion.div
                        key="comments"
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                      >
                        <CommentSection taskId={taskId} teamId={activeTeam._id} members={teamMembers} />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="attachments"
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                      >
                        <AttachmentPanel taskId={taskId} teamId={activeTeam._id} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN — status, priority, due date, assignees, meta */}
          <div className="flex w-80 flex-shrink-0 flex-col overflow-y-auto">
            <div className="space-y-5 p-5">

              {/* Status */}
              <div>
                <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Status
                </label>
                <div className="flex flex-col gap-1.5">
                  {TASK_STATUSES.map(({ id, label, color }) => (
                    <button
                      key={id}
                      onClick={() => handleStatusChange(id)}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all text-left',
                        fullTask.status === id
                          ? 'border-transparent text-white shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                      )}
                      style={fullTask.status === id ? { backgroundColor: color } : {}}
                    >
                      <div
                        className="h-2 w-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: fullTask.status === id ? 'rgba(255,255,255,0.7)' : color }}
                      />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <Flag className="h-3.5 w-3.5" /> Priority
                </label>
                <div className="flex flex-col gap-1.5">
                  {(['urgent', 'high', 'medium', 'low'] as TaskPriority[]).map((p) => {
                    const config = PRIORITY_CONFIG[p];
                    return (
                      <button
                        key={p}
                        onClick={() => handlePriorityChange(p)}
                        className={cn(
                          'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all text-left',
                          fullTask.priority === p
                            ? config.bg + ' border-transparent'
                            : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                        )}
                      >
                        <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: config.color }} />
                        {config.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Due Date */}
              <div>
                <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <Calendar className="h-3.5 w-3.5" /> Due Date
                </label>
                <input
                  type="date"
                  value={localDueDate}
                  onChange={(e) => setLocalDueDate(e.target.value)}
                  onBlur={(e) => {
                    const newDate = e.target.value || null;
                    const currentDate = fullTask.dueDate ? fullTask.dueDate.slice(0, 10) : null;
                    if (newDate !== currentDate) {
                      handleSave({ dueDate: newDate } as any);
                    }
                  }}
                  className="input-field w-full"
                />
                {dueDateStatus && (
                  <p className={cn('mt-1.5 flex items-center gap-1 text-xs font-medium', dueDateStatus.color)}>
                    <Clock className="h-3 w-3" />
                    {dueDateStatus.label}
                  </p>
                )}
              </div>

              {/* Assignees */}
              {activeTeam && (
                <div>
                  <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <Users className="h-3.5 w-3.5" /> Assignees
                    {assigneeIds.length > 0 && (
                      <span className="ml-1 rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-600 dark:bg-brand-500/20 dark:text-brand-400">
                        {assigneeIds.length}
                      </span>
                    )}
                  </label>
                  <div className="space-y-1.5">
                    {activeTeam.members.map((m) => {
                      const isAssigned = assigneeIds.includes(m.user._id);
                      return (
                        <button
                          key={m.user._id}
                          onClick={() => handleAssigneeToggle(m.user._id)}
                          className={cn(
                            'flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-all',
                            isAssigned
                              ? 'border-brand-200 bg-brand-50 dark:border-brand-800 dark:bg-brand-500/10'
                              : 'border-slate-100 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700'
                          )}
                        >
                          <Avatar name={m.user.name} src={m.user.avatar} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-slate-900 dark:text-slate-100">{m.user.name}</p>
                            <p className="truncate text-[10px] text-slate-400">{m.role}</p>
                          </div>
                          {isAssigned && <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-brand-500" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Meta info */}
              <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <Info className="h-3.5 w-3.5" /> Info
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Created by</span>
                    <div className="flex items-center gap-1.5">
                      <Avatar name={fullTask.createdBy?.name || 'Unknown'} src={fullTask.createdBy?.avatar} size="xs" />
                      <span className="font-medium text-slate-600 dark:text-slate-300">{fullTask.createdBy?.name}</span>
                    </div>
                  </div>
                  {fullTask.createdAt && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Created</span>
                      <span className="font-medium text-slate-600 dark:text-slate-300">{formatRelative(fullTask.createdAt)}</span>
                    </div>
                  )}
                  {fullTask.completedAt && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Completed</span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatRelative(fullTask.completedAt)}</span>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
