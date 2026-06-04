import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { authService } from '@/services/authService';

type Status = 'loading' | 'success' | 'error';

export const VerifyEmailPage = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('Verifying your email…');
  const ran = useRef(false);

  useEffect(() => {
    // Guard against React 18 StrictMode double-invoke in dev.
    if (ran.current) return;
    ran.current = true;

    if (!token) {
      setStatus('error');
      setMessage('This verification link is missing its token.');
      return;
    }

    authService
      .verifyEmail(token)
      .then((msg) => {
        setStatus('success');
        setMessage(msg || 'Your email has been verified.');
      })
      .catch((err: any) => {
        setStatus('error');
        setMessage(err.response?.data?.message || 'This verification link is invalid or has expired.');
      });
  }, [token]);

  const icon =
    status === 'loading' ? <Loader2 className="h-7 w-7 animate-spin text-brand-500" />
    : status === 'success' ? <CheckCircle2 className="h-7 w-7 text-emerald-500" />
    : <XCircle className="h-7 w-7 text-red-500" />;

  const iconBg =
    status === 'loading' ? 'bg-brand-500/10'
    : status === 'success' ? 'bg-emerald-500/10'
    : 'bg-red-500/10';

  const heading =
    status === 'loading' ? 'Verifying…'
    : status === 'success' ? 'Email verified!'
    : 'Verification failed';

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12 dark:bg-slate-950">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm text-center"
      >
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold text-slate-900 dark:text-white">TaskFlow</span>
        </div>

        <div className={`mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full ${iconBg}`}>
          {icon}
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{heading}</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{message}</p>

        {status !== 'loading' && (
          <Link to="/" className="mt-8 inline-block btn-primary">
            {status === 'success' ? 'Go to dashboard' : 'Back to TaskFlow'}
          </Link>
        )}
      </motion.div>
    </div>
  );
};
