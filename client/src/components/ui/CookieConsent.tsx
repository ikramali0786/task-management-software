import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie } from 'lucide-react';

/**
 * GDPR cookie-consent banner. Shows once until the visitor makes a choice,
 * persisted in localStorage. "Essential only" and "Accept all" are recorded
 * distinctly so non-essential storage/analytics can gate on the stored value
 * (`localStorage.cookieConsent === 'accepted'`).
 *
 * Rendered globally (App root) so it appears on every page, including the
 * public auth and privacy routes.
 */

const STORAGE_KEY = 'cookieConsent';

export const hasAnalyticsConsent = (): boolean =>
  localStorage.getItem(STORAGE_KEY) === 'accepted';

export const CookieConsent = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Defer to next tick so it doesn't compete with first paint.
    const id = window.setTimeout(() => {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    }, 600);
    return () => window.clearTimeout(id);
  }, []);

  const choose = (value: 'accepted' | 'essential') => {
    localStorage.setItem(STORAGE_KEY, value);
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          role="dialog"
          aria-label="Cookie consent"
          className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-4 sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-sm sm:px-0"
        >
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand-500/10">
                <Cookie className="h-5 w-5 text-brand-500" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  We value your privacy
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  We use strictly necessary storage to keep you signed in. With your consent we
                  also use optional analytics to improve TaskFlow. See our{' '}
                  <a href="/privacy" className="font-medium text-brand-500 hover:underline">
                    Privacy Policy
                  </a>
                  .
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => choose('essential')}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Essential only
              </button>
              <button
                onClick={() => choose('accepted')}
                className="flex-1 rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-600"
              >
                Accept all
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
