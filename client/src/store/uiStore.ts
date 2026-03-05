import { create } from 'zustand';
import { Theme } from '../types';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
}

export interface ConfirmDialogState extends Required<ConfirmOptions> {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

interface UIStore {
  theme: Theme;
  sidebarOpen: boolean;
  activeModal: string | null;
  activeTaskId: string | null;
  toasts: Toast[];
  confirmDialog: ConfirmDialogState | null;
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  openTaskDetail: (taskId: string) => void;
  closeModal: () => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  showConfirm: (options: ConfirmOptions) => Promise<boolean>;
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
}

const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  if (theme === 'dark') root.classList.add('dark');
  else if (theme === 'light') root.classList.remove('dark');
  else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    prefersDark ? root.classList.add('dark') : root.classList.remove('dark');
  }
};

const savedTheme = (localStorage.getItem('theme') as Theme) || 'system';
applyTheme(savedTheme);

// Default sidebar open only on wide screens (≥ 1024 px = Tailwind "lg")
const defaultSidebarOpen =
  typeof window !== 'undefined' ? window.innerWidth >= 1024 : true;

export const useUIStore = create<UIStore>((set) => ({
  theme: savedTheme,
  sidebarOpen: defaultSidebarOpen,
  activeModal: null,
  activeTaskId: null,
  toasts: [],
  confirmDialog: null,

  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    applyTheme(theme);
    set({ theme });
  },

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  openTaskDetail: (taskId) => set({ activeTaskId: taskId, activeModal: 'task-detail' }),
  closeModal: () => set({ activeModal: null, activeTaskId: null }),

  addToast: (toast) => {
    const id = Math.random().toString(36).slice(2);
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },

  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  showConfirm: (options) =>
    new Promise<boolean>((resolve) => {
      set({
        confirmDialog: {
          isOpen: true,
          title: options.title,
          message: options.message,
          confirmLabel: options.confirmLabel ?? 'Delete',
          cancelLabel: options.cancelLabel ?? 'Cancel',
          variant: options.variant ?? 'danger',
          onConfirm: () => {
            set({ confirmDialog: null });
            resolve(true);
          },
          onCancel: () => {
            set({ confirmDialog: null });
            resolve(false);
          },
        },
      });
    }),
}));
