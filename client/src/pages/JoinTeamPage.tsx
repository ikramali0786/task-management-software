import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, CheckCircle2, XCircle, Loader2, Users } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { teamService } from '@/services/teamService';

type Status = 'loading' | 'success' | 'error' | 'guest';

export const JoinTeamPage = () => {
  const [params] = useSearchParams();
  const code = params.get('code') || '';
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('Joining team…');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    if (!code) {
      setStatus('error');
      setMessage('This invite link is missing its code.');
      return;
    }

    // Stash the code so the auth flow can finish the join after sign-in/up.
    sessionStorage.setItem('pendingInviteCode', code);

    if (!isAuthenticated) {
      setStatus('guest');
      return;
    }

    teamService
      .joinByCode(code)
      .then((team) => {
        sessionStorage.removeItem('pendingInviteCode');
        setStatus('success');
        setMessage(`You've joined ${team?.name || 'the team'}. Redirecting…`);
        setTimeout(() => navigate('/team', { replace: true }), 1800);
      })
      .catch((err: any) => {
        sessionStorage.removeItem('pendingInviteCode');
        setStatus('error');
        setMessage(err.response?.data?.message || 'This invite is invalid or has expired.');
      });
  }, [code, isAuthenticated, navigate]);

  const icon =
    status === 'loading' ? <Loader2 className="h-7 w-7 animate-spin text-brand-500" />
    : status === 'success' ? <CheckCircle2 className="h-7 w-7 text-emerald-500" />
    : status === 'guest' ? <Users className="h-7 w-7 text-brand-500" />
    : <XCircle className="h-7 w-7 text-red-500" />;

  const iconBg =
    status === 'success' ? 'bg-emerald-500/10'
    : status === 'error' ? 'bg-red-500/10'
    : 'bg-brand-500/10';

  const heading =
    status === 'loading' ? 'Joining…'
    : status === 'success' ? 'Welcome aboard!'
    : status === 'guest' ? "You've been invited"
    : 'Invite problem';

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12 dark:bg-slate-950">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm text-center"
      >
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold text-slate-900 dark:text-white">TaskFlow</span>
        </div>

        <div className={`mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full ${iconBg}`}>
          {icon}
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{heading}</h2>

        {status === 'guest' ? (
          <>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Create an account or sign in to join the team. We'll add you automatically once you're in.
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <Link to={`/register?invite=${encodeURIComponent(code)}`} className="btn-primary w-full">
                Create account
              </Link>
              <Link
                to="/login"
                className="text-sm font-medium text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
              >
                I already have an account
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{message}</p>
            {status === 'error' && (
              <Link to="/" className="mt-8 inline-block btn-primary">Back to TaskFlow</Link>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
};
