import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, WifiOff } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user, loadUser } = useAuthStore();
  const [checking, setChecking] = useState(!user && isAuthenticated);
  const [slow, setSlow] = useState(false);     // shown after 5 s
  const [timedOut, setTimedOut] = useState(false); // shown after 35 s
  const location = useLocation();

  useEffect(() => {
    if (!user && isAuthenticated) {
      // Show "waking up" hint after 5 seconds
      const slowTimer = setTimeout(() => setSlow(true), 5_000);

      // Hard bail-out: if the request hangs more than 35 s, stop the spinner
      // and treat the session as invalid so the user can at least reach /login
      const bailTimer = setTimeout(() => {
        setTimedOut(true);
        setChecking(false);
      }, 35_000);

      loadUser().finally(() => {
        clearTimeout(slowTimer);
        clearTimeout(bailTimer);
        setSlow(false);
        setChecking(false);
      });

      return () => {
        clearTimeout(slowTimer);
        clearTimeout(bailTimer);
      };
    }
  }, []);

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4 text-center">
          {/* Animated logo */}
          <div className="relative">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-brand-200 border-t-brand-500 dark:border-slate-700 dark:border-t-brand-400" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Zap className="h-5 w-5 text-brand-500" />
            </div>
          </div>

          <AnimatePresence mode="wait">
            {!slow ? (
              <motion.p
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm text-slate-400"
              >
                Loading TaskFlow…
              </motion.p>
            ) : (
              <motion.div
                key="slow"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-1"
              >
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  Server is waking up…
                </p>
                <p className="text-xs text-slate-400">
                  This can take up to 30 seconds on first load.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // If the 35 s bail-out fired, treat session as expired → go to login
  if (timedOut && !isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
