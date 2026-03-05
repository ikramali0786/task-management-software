import { useEffect, useRef } from 'react';
import { getSocket } from '@/lib/socket';
import { useTaskStore } from '@/store/taskStore';
import { useNotificationStore } from '@/store/notificationStore';
import { usePrefsStore } from '@/store/prefsStore';
import { Task, Notification } from '@/types';

// ── Sound synthesiser ────────────────────────────────────────────────────────
// Three distinct tones, all built from Web Audio API — no external assets needed.

type SoundType = 'task' | 'member' | 'notification';

const playSound = (type: SoundType) => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);

    if (type === 'task') {
      // Gentle two-note descending ding (task create / update)
      const osc = ctx.createOscillator();
      osc.connect(gainNode);
      osc.type = 'sine';
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.setValueAtTime(440, ctx.currentTime + 0.18);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
      osc.onended = () => ctx.close();
    } else if (type === 'member') {
      // Warm ascending three-note chord (new member joined)  C5 → E5 → G5
      const notes = [523, 659, 784];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.connect(g);
        g.connect(ctx.destination);
        osc.type = 'sine';
        const start = ctx.currentTime + i * 0.12;
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(0.1, start + 0.04);
        g.gain.exponentialRampToValueAtTime(0.001, start + 0.55);
        osc.frequency.setValueAtTime(freq, start);
        osc.start(start);
        osc.stop(start + 0.55);
        if (i === notes.length - 1) osc.onended = () => ctx.close();
      });
    } else {
      // Single descending bell ping (general notification)
      const osc = ctx.createOscillator();
      osc.connect(gainNode);
      osc.type = 'sine';
      gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
      osc.onended = () => ctx.close();
    }
  } catch {
    // AudioContext not available — skip silently
  }
};

const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'In Review',
  done: 'Done',
};

export const useSocketEvents = () => {
  const { applySocketTask, applySocketUpdate, applySocketDelete } = useTaskStore();
  const { addNotification, addTaskActivity } = useNotificationStore();

  const lastSoundAt = useRef<Record<SoundType, number>>({ task: 0, member: 0, notification: 0 });

  const throttledSound = (type: SoundType) => {
    const { soundEnabled } = usePrefsStore.getState();
    if (!soundEnabled) return;
    const now = Date.now();
    if (now - lastSoundAt.current[type] > 1500) {
      lastSoundAt.current[type] = now;
      playSound(type);
    }
  };

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleTaskCreated = ({ task }: { task: Task }) => {
      applySocketTask(task);
      throttledSound('task');
      const actorName = (task.createdBy as any)?.name || 'Someone';
      addTaskActivity({
        _id: `ta-${Date.now()}-${Math.random()}`,
        message: `${actorName} created "${task.title}"`,
        createdAt: task.createdAt || new Date().toISOString(),
        icon: 'task',
      });
    };

    const handleTaskUpdated = ({ taskId, changes }: { taskId: string; changes: Partial<Task> }) => {
      // Read title before store update (title doesn't change, but look it up for the message)
      const existingTask = useTaskStore.getState().tasks[taskId];
      applySocketUpdate(taskId, changes);
      throttledSound('task');

      const taskTitle = existingTask?.title || 'A task';
      let message: string;
      if (changes.status) {
        message = `"${taskTitle}" moved to ${STATUS_LABELS[changes.status] || changes.status}`;
      } else if (changes.title) {
        message = `Task renamed to "${changes.title}"`;
      } else {
        message = `"${taskTitle}" was updated`;
      }
      addTaskActivity({
        _id: `ta-${Date.now()}-${Math.random()}`,
        message,
        createdAt: new Date().toISOString(),
        icon: 'task',
      });
    };

    const handleTaskDeleted = ({ taskId }: { taskId: string }) => {
      const existingTask = useTaskStore.getState().tasks[taskId];
      applySocketDelete(taskId);
      if (existingTask) {
        addTaskActivity({
          _id: `ta-${Date.now()}-${Math.random()}`,
          message: `"${existingTask.title}" was deleted`,
          createdAt: new Date().toISOString(),
          icon: 'task',
        });
      }
    };

    const handleTaskMoved = ({ taskId, newStatus, newPosition }: {
      taskId: string; newStatus: any; newPosition: number;
    }) => {
      const existingTask = useTaskStore.getState().tasks[taskId];
      applySocketUpdate(taskId, { status: newStatus, position: newPosition });
      throttledSound('task');
      const taskTitle = existingTask?.title || 'A task';
      addTaskActivity({
        _id: `ta-${Date.now()}-${Math.random()}`,
        message: `"${taskTitle}" moved to ${STATUS_LABELS[newStatus] || newStatus}`,
        createdAt: new Date().toISOString(),
        icon: 'task',
      });
    };

    const handleNotification = ({ notification }: { notification: Notification }) => {
      const prefs = usePrefsStore.getState();
      // Filter by notification type preference
      const typeMap: Record<string, keyof typeof prefs> = {
        task_assigned: 'notifyTaskAssigned',
        task_updated: 'notifyTaskUpdated',
        task_completed: 'notifyTaskCompleted',
        team_invite: 'notifyTeamEvents',
        member_joined: 'notifyTeamEvents',
      };
      const prefKey = typeMap[notification.type];
      if (prefKey && prefs[prefKey] === false) return;

      addNotification(notification);
      // Use distinct sound for new member joining, standard for everything else
      if (notification.type === 'member_joined') {
        throttledSound('member');
      } else {
        throttledSound('notification');
      }
    };

    socket.on('task:created', handleTaskCreated);
    socket.on('task:updated', handleTaskUpdated);
    socket.on('task:deleted', handleTaskDeleted);
    socket.on('task:moved', handleTaskMoved);
    socket.on('notification:new', handleNotification);

    return () => {
      socket.off('task:created', handleTaskCreated);
      socket.off('task:updated', handleTaskUpdated);
      socket.off('task:deleted', handleTaskDeleted);
      socket.off('task:moved', handleTaskMoved);
      socket.off('notification:new', handleNotification);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
