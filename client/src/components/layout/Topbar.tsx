import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Bell, Sun, Moon, Monitor } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useAuthStore } from '@/store/authStore';
import { Avatar } from '@/components/ui/Avatar';
import { NotificationPanel } from '@/components/notifications/NotificationPanel';
import { cn } from '@/lib/utils';

const themeIcons = { light: Sun, dark: Moon, system: Monitor };

export const Topbar = ({ title }: { title?: string }) => {
  const { theme, setTheme, toggleSidebar } = useUIStore();
  const { unreadCount } = useNotificationStore();
  const { user } = useAuthStore();
  const [notifOpen, setNotifOpen] = useState(false);

  const ThemeIcon = themeIcons[theme];
  const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';

  return (
    <>
      <header className="flex h-14 items-center gap-4 border-b border-slate-100 bg-white/80 px-5 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80">
        <button
          onClick={toggleSidebar}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
        >
          <Menu className="h-5 w-5" />
        </button>

        {title && (
          <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
        )}

        <div className="flex-1" />

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(nextTheme as any)}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 transition-colors"
          title={`Switch to ${nextTheme} mode`}
        >
          <ThemeIcon className="h-4 w-4" />
        </button>

        {/* Notification bell */}
        <button
          onClick={() => setNotifOpen(true)}
          className="relative rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 transition-colors"
        >
          <Bell className="h-4 w-4" />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* User avatar */}
        <Avatar name={user?.name || 'User'} src={user?.avatar} size="sm" />
      </header>

      <NotificationPanel isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
    </>
  );
};
