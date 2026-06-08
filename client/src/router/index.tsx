import { lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { MarketingLayout } from '@/components/marketing/MarketingLayout';
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
const GoalsPage    = lazy(() => import('@/pages/GoalsPage').then(m => ({ default: m.GoalsPage })));
const TimelinePage = lazy(() => import('@/pages/TimelinePage').then(m => ({ default: m.TimelinePage })));
const WhiteboardPage = lazy(() => import('@/pages/WhiteboardPage').then(m => ({ default: m.WhiteboardPage })));
const StatusPage   = lazy(() => import('@/pages/StatusPage').then(m => ({ default: m.StatusPage })));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage  = lazy(() => import('@/pages/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })));
const VerifyEmailPage    = lazy(() => import('@/pages/VerifyEmailPage').then(m => ({ default: m.VerifyEmailPage })));
const JoinTeamPage       = lazy(() => import('@/pages/JoinTeamPage').then(m => ({ default: m.JoinTeamPage })));
const PrivacyPage        = lazy(() => import('@/pages/PrivacyPage').then(m => ({ default: m.PrivacyPage })));

// ── Marketing (public) pages ─────────────────────────────────────────────────
const LandingPage     = lazy(() => import('@/pages/marketing/LandingPage').then(m => ({ default: m.LandingPage })));
const FeaturesPage    = lazy(() => import('@/pages/marketing/FeaturesPage').then(m => ({ default: m.FeaturesPage })));
const PricingPage     = lazy(() => import('@/pages/marketing/PricingPage').then(m => ({ default: m.PricingPage })));
const HelpPage        = lazy(() => import('@/pages/marketing/HelpPage').then(m => ({ default: m.HelpPage })));
const HelpArticlePage = lazy(() => import('@/pages/marketing/HelpArticlePage').then(m => ({ default: m.HelpArticlePage })));
const ContactPage     = lazy(() => import('@/pages/marketing/ContactPage').then(m => ({ default: m.ContactPage })));

// ── Public share pages (no auth, no layout) ──────────────────────────────────
const IntakeFormPage  = lazy(() => import('@/pages/public/IntakeFormPage').then(m => ({ default: m.IntakeFormPage })));
const PublicBoardPage = lazy(() => import('@/pages/public/PublicBoardPage').then(m => ({ default: m.PublicBoardPage })));

// ── Router definition ─────────────────────────────────────────────────────────

export const router = createBrowserRouter([
  // Standalone (no layout) pages
  { path: '/status', element: <StatusPage /> },
  { path: '/login', element: <GuestGuard><LoginPage /></GuestGuard> },
  { path: '/register', element: <GuestGuard><RegisterPage /></GuestGuard> },
  { path: '/forgot-password', element: <GuestGuard><ForgotPasswordPage /></GuestGuard> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/verify-email', element: <VerifyEmailPage /> },
  { path: '/join', element: <JoinTeamPage /> },
  { path: '/privacy', element: <PrivacyPage /> },
  { path: '/f/:token', element: <IntakeFormPage /> },
  { path: '/b/:token', element: <PublicBoardPage /> },

  // Public marketing site
  {
    path: '/',
    element: <MarketingLayout />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'features', element: <FeaturesPage /> },
      { path: 'pricing', element: <PricingPage /> },
      { path: 'help', element: <HelpPage /> },
      { path: 'help/:slug', element: <HelpArticlePage /> },
      { path: 'contact', element: <ContactPage /> },
    ],
  },

  // Authenticated app
  {
    path: '/app',
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
      { path: 'timeline', element: <TimelinePage /> },
      { path: 'whiteboard', element: <WhiteboardPage /> },
      { path: 'goals',    element: <GoalsPage /> },
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
