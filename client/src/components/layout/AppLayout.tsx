import { useState, useEffect, Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ToastContainer } from '@/components/ui/Toast';
import { ShortcutsModal } from '@/components/ui/ShortcutsModal';
import { useTeamStore } from '@/store/teamStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useSocketEvents } from '@/hooks/useSocketEvents';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useUIStore } from '@/store/uiStore';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/board': 'Kanban Board',
  '/team': 'Team',
  '/workload': 'Workload',
  '/activity': 'Activity',
  '/chatbots': 'AI Chatbots',
  '/settings': 'Settings',
};

/** Minimal spinner shown while a lazy-loaded page chunk is fetching */
const PageLoader = () => (
  <div className="flex h-full items-center justify-center">
    <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
  </div>
);

export const AppLayout = () => {
  const { fetchTeams } = useTeamStore();
  const { fetchUnreadCount, fetchNotifications } = useNotificationStore();
  const { activeModal, closeModal, toggleSidebar } = useUIStore();
  const location = useLocation();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useSocketEvents();

  useEffect(() => {
    fetchTeams();
    fetchUnreadCount();
    fetchNotifications();
  }, []);

  /**
   * Global Escape key safety net — if the modal's own handler somehow misses
   * the keypress, this layout-level listener closes any stuck overlay and
   * restores body overflow to prevent an unresponsive page.
   */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeModal) {
        document.body.style.overflow = '';
        closeModal();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [activeModal, closeModal]);

  /** Wire up all keyboard shortcuts for the authenticated shell */
  useKeyboardShortcuts({
    onToggleShortcuts: () => setShortcutsOpen((v) => !v),
    onToggleSidebar: toggleSidebar,
  });

  const title = pageTitles[location.pathname] || 'TaskFlow';

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar title={title} />

        {/*
          Page transition: each route change re-mounts the motion.main element
          (via the key prop) which triggers the enter animation.
          No AnimatePresence needed — exit animations would add unnecessary latency.
        */}
        <Suspense fallback={<PageLoader />}>
          <motion.main
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="flex-1 overflow-y-auto"
          >
            <Outlet />
          </motion.main>
        </Suspense>
      </div>

      <ToastContainer />

      {/* Keyboard shortcuts help modal — press ? anywhere to open */}
      <ShortcutsModal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
};
