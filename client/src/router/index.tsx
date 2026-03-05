import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { KanbanPage } from '@/pages/KanbanPage';
import { TeamPage } from '@/pages/TeamPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { WorkloadPage } from '@/pages/WorkloadPage';
import { ChatbotsPage } from '@/pages/ChatbotsPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    path: '/',
    element: (
      <AuthGuard>
        <AppLayout />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'board', element: <KanbanPage /> },
      { path: 'team', element: <TeamPage /> },
      { path: 'workload', element: <WorkloadPage /> },
      { path: 'chatbots', element: <ChatbotsPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
  {
    path: '*',
    element: (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <h1 className="text-4xl font-bold gradient-text">404</h1>
        <p className="text-slate-500">Page not found</p>
        <a href="/" className="btn-primary">Go home</a>
      </div>
    ),
  },
]);
