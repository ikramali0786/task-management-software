import { create } from 'zustand';
import { User } from '../types';
import { authService } from '../services/authService';
import { initSocket, disconnectSocket, joinTeamRooms } from '../lib/socket';

interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  token: localStorage.getItem('accessToken'),
  isAuthenticated: !!localStorage.getItem('accessToken'),
  isLoading: false,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { accessToken, user } = await authService.login({ email, password });
      localStorage.setItem('accessToken', accessToken);

      const socket = initSocket(accessToken);
      const teamIds = (user.teams || []).map((t) => (typeof t === 'string' ? t : t._id));
      socket.on('connect', () => joinTeamRooms(teamIds));

      set({ user, token: accessToken, isAuthenticated: true, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  register: async (name, email, password) => {
    set({ isLoading: true });
    try {
      const { accessToken, user } = await authService.register({ name, email, password });
      localStorage.setItem('accessToken', accessToken);

      const socket = initSocket(accessToken);
      socket.on('connect', () => joinTeamRooms([]));

      set({ user, token: accessToken, isAuthenticated: true, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    try {
      await authService.logout();
    } finally {
      localStorage.removeItem('accessToken');
      disconnectSocket();
      set({ user: null, token: null, isAuthenticated: false });
    }
  },

  loadUser: async () => {
    const token = get().token;
    if (!token) return;
    try {
      const user = await authService.getMe();
      const socket = initSocket(token);
      const teamIds = (user.teams || []).map((t) => (typeof t === 'string' ? t : t._id));
      socket.on('connect', () => joinTeamRooms(teamIds));
      if (socket.connected) joinTeamRooms(teamIds);
      set({ user, isAuthenticated: true });
    } catch {
      localStorage.removeItem('accessToken');
      set({ user: null, token: null, isAuthenticated: false });
    }
  },

  updateUser: (data) => {
    set((state) => ({ user: state.user ? { ...state.user, ...data } : null }));
  },
}));
