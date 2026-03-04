import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ToastContainer } from '@/components/ui/Toast';
import { useTeamStore } from '@/store/teamStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useSocketEvents } from '@/hooks/useSocketEvents';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/board': 'Kanban Board',
  '/team': 'Team',
  '/settings': 'Settings',
};

export const AppLayout = () => {
  const { fetchTeams } = useTeamStore();
  const { fetchUnreadCount } = useNotificationStore();
  const location = useLocation();

  useSocketEvents();

  useEffect(() => {
    fetchTeams();
    fetchUnreadCount();
  }, []);

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
