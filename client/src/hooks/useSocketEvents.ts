import { useEffect } from 'react';
import { getSocket } from '@/lib/socket';
import { useTaskStore } from '@/store/taskStore';
import { useNotificationStore } from '@/store/notificationStore';
import { Task, Notification } from '@/types';

export const useSocketEvents = () => {
  const { applySocketTask, applySocketUpdate, applySocketDelete } = useTaskStore();
  const { addNotification } = useNotificationStore();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleTaskCreated = ({ task }: { task: Task }) => applySocketTask(task);
    const handleTaskUpdated = ({ taskId, changes }: { taskId: string; changes: Partial<Task> }) =>
      applySocketUpdate(taskId, changes);
    const handleTaskDeleted = ({ taskId }: { taskId: string }) => applySocketDelete(taskId);
    const handleTaskMoved = ({ taskId, newStatus, newPosition }: { taskId: string; newStatus: any; newPosition: number }) =>
      applySocketUpdate(taskId, { status: newStatus, position: newPosition });
    const handleNotification = ({ notification }: { notification: Notification }) =>
      addNotification(notification);

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
  }, []);
};
