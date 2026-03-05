import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ToastContainer } from '@/components/ui/Toast';
import { useTeamStore } from '@/store/teamStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useSocketEvents } from '@/hooks/useSocketEvents';
import { useUIStore } from '@/store/uiStore';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/board': 'Kanban Board',
  '/team': 'Team',
  '/workload': 'Workload',
  '/chatbots': 'AI Chatbots',
  '/settings': 'Settings',
};

export const AppLayout = () => {
  const { fetchTeams } = useTeamStore();
  const { fetchUnreadCount, fetchNotifications } = useNotificationStore();
  const { activeModal, closeModal } = useUIStore();
  const location = useLocation();

  useSocketEvents();

  useEffect(() => {
    fetchTeams();
    fetchUnreadCount();
    fetchNotifications(); // populates the Recent Activity feed on the dashboard
  }, []);

  /**
   * Global Escape key safety net — if the modal's own Escape handler somehow
   * fails (stale closure, focus lost to an iframe, etc.) this layout-level
   * listener forces a close and restores body overflow, preventing the user
   * from being stuck on a non-interactive page.
   */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeModal) {
        document.body.style.overflow = ''; // ensure scroll is always restored
        closeModal();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [activeModal, closeModal]);

  const title = pageTitles[location.pathname] || 'TaskFlow';

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar title={title} />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <ToastContainer />
    </div>
  );
};
