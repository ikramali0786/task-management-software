import api from './api';
import { User } from '../types';

interface LoginData { email: string; password: string; }
interface RegisterData { name: string; email: string; password: string; }

export const authService = {
  register: async (data: RegisterData) => {
    const res = await api.post('/auth/register', data);
    return res.data.data as { accessToken: string; user: User };
  },
  login: async (data: LoginData) => {
    const res = await api.post('/auth/login', data);
    return res.data.data as { accessToken: string; user: User };
  },
  logout: async () => {
    await api.post('/auth/logout');
  },
  getMe: async () => {
    const res = await api.get('/auth/me');
    return res.data.data.user as User;
  },
  updateMe: async (data: Partial<User>) => {
    const res = await api.patch('/auth/me', data);
    return res.data.data.user as User;
  },
  changePassword: async (data: { currentPassword: string; newPassword: string }) => {
    await api.patch('/auth/me/password', data);
  },
};
