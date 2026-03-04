import { useEffect, useRef } from 'react';
import { getSocket } from '@/lib/socket';
import { useTaskStore } from '@/store/taskStore';
import { useNotificationStore } from '@/store/notificationStore';
import { Task, Notification } from '@/types';

// Synthesise a soft bell ping using Web Audio API — no external assets needed
const playNotificationSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);           // A5
    oscillator.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3); // fade to A4

    gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.6);
    oscillator.onended = () => ctx.close();
  } catch {
    // AudioContext not available — skip silently
  }
};

export const useSocketEvents = () => {
  const { applySocketTask, applySocketUpdate, applySocketDelete } = useTaskStore();
  const { addNotification } = useNotificationStore();
  const lastSoundAt = useRef(0);

  const throttledSound = () => {
    const now = Date.now();
    if (now - lastSoundAt.current > 1500) { // max one ping per 1.5 s
      lastSoundAt.current = now;
      playNotificationSound();
    }
  };

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleTaskCreated = ({ task }: { task: Task }) => {
      applySocketTask(task);
      throttledSound();
    };

    const handleTaskUpdated = ({ taskId, changes }: { taskId: string; changes: Partial<Task> }) => {
      applySocketUpdate(taskId, changes);
      throttledSound();
    };

    const handleTaskDeleted = ({ taskId }: { taskId: string }) => applySocketDelete(taskId);

    const handleTaskMoved = ({ taskId, newStatus, newPosition }: {
      taskId: string; newStatus: any; newPosition: number;
    }) => applySocketUpdate(taskId, { status: newStatus, position: newPosition });

    const handleNotification = ({ notification }: { notification: Notification }) => {
      addNotification(notification);
      throttledSound();
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
