import { lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { GuestGuard } from '@/components/auth/GuestGuard';

// ── Lazy-load every page so each becomes a separate JS chunk ─────────────────
// Vite splits each dynamic import into its own chunk — only the first page
// visited loads on start-up; all others are fetched on first navigation.

const LoginPage    = lazy(() => import('@/pages/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('@/pages/RegisterPage').then(m => ({ default: m.RegisterPage })));
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const KanbanPage   = lazy(() => import('@/pages/KanbanPage').then(m => ({ default: m.KanbanPage })));
const TeamPage     = lazy(() => import('@/pages/TeamPage').then(m => ({ default: m.TeamPage })));
const WorkloadPage = lazy(() => import('@/pages/WorkloadPage').then(m => ({ default: m.WorkloadPage })));
const ActivityPage = lazy(() => import('@/pages/ActivityPage').then(m => ({ default: m.ActivityPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const ChatbotsPage = lazy(() => import('@/pages/ChatbotsPage').then(m => ({ default: m.ChatbotsPage })));
const CalendarPage = lazy(() => import('@/pages/CalendarPage').then(m => ({ default: m.CalendarPage })));
const MyTasksPage  = lazy(() => import('@/pages/MyTasksPage').then(m => ({ default: m.MyTasksPage })));
const StatusPage   = lazy(() => import('@/pages/StatusPage').then(m => ({ default: m.StatusPage })));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage  = lazy(() => import('@/pages/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })));
const VerifyEmailPage    = lazy(() => import('@/pages/VerifyEmailPage').then(m => ({ default: m.VerifyEmailPage })));
const JoinTeamPage       = lazy(() => import('@/pages/JoinTeamPage').then(m => ({ default: m.JoinTeamPage })));
const PrivacyPage        = lazy(() => import('@/pages/PrivacyPage').then(m => ({ default: m.PrivacyPage })));

// ── Router definition ─────────────────────────────────────────────────────────

export const router = createBrowserRouter([
  {
    path: '/status',
    element: <StatusPage />,
  },
  {
    path: '/login',
    element: <GuestGuard><LoginPage /></GuestGuard>,
  },
  {
    path: '/register',
    element: <GuestGuard><RegisterPage /></GuestGuard>,
  },
  {
    path: '/forgot-password',
    element: <GuestGuard><ForgotPasswordPage /></GuestGuard>,
  },
  {
    path: '/reset-password',
    element: <ResetPasswordPage />,
  },
  {
    path: '/verify-email',
    element: <VerifyEmailPage />,
  },
  {
    path: '/join',
    element: <JoinTeamPage />,
  },
  {
    path: '/privacy',
    element: <PrivacyPage />,
  },
  {
    path: '/',
    element: (
      <AuthGuard>
        <AppLayout />
      </AuthGuard>
    ),
    children: [
      { index: true,      element: <DashboardPage /> },
      { path: 'my-tasks', element: <MyTasksPage /> },
      { path: 'board',    element: <KanbanPage /> },
      { path: 'team',     element: <TeamPage /> },
      { path: 'workload', element: <WorkloadPage /> },
      { path: 'activity', element: <ActivityPage /> },
      { path: 'chatbots', element: <ChatbotsPage /> },
      { path: 'calendar', element: <CalendarPage /> },
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
