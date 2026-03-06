import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

/**
 * Wraps public-only routes (login, register).
 * Redirects to the app ONLY when the session is fully confirmed — i.e. the
 * user object has been loaded from the API.  Checking isAuthenticated alone
 * is not enough: on a fresh page load, isAuthenticated is true whenever a
 * token exists in localStorage, but that token may be stale/expired and the
 * user object is null until loadUser() verifies it.  Redirecting on a stale
 * token forces a 30-second trip through AuthGuard before the login page
 * finally appears — the root cause of the "keeps loading" bug.
 */
export const GuestGuard = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user } = useAuthStore();

  // Only redirect when we have a confirmed, loaded session
  if (isAuthenticated && user) return <Navigate to="/" replace />;

  return <>{children}</>;
};
