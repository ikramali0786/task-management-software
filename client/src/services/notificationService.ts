import api from './api';
import { Notification } from '../types';

export const notificationService = {
  getNotifications: async (params?: Record<string, string>) => {
    const res = await api.get('/notifications', { params });
    return res.data.data as { notifications: Notification[]; total: number };
  },
  getUnreadCount: async () => {
    const res = await api.get('/notifications/unread-count');
    return res.data.data.count as number;
  },
  markRead: async (id: string) => {
    const res = await api.patch(`/notifications/${id}/read`);
    return res.data.data.notification as Notification;
  },
  markAllRead: async () => {
    await api.patch('/notifications/read-all');
  },
  deleteNotification: async (id: string) => {
    await api.delete(`/notifications/${id}`);
  },
};
