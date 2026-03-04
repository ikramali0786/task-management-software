import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user, loadUser } = useAuthStore();
  const [checking, setChecking] = useState(!user && isAuthenticated);
  const location = useLocation();

  useEffect(() => {
    if (!user && isAuthenticated) {
      loadUser().finally(() => setChecking(false));
    }
  }, []);

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Loading TaskFlow...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
