import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

/** Wraps public-only routes (login, register). Redirects authenticated users to the app root. */
export const GuestGuard = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
};
