import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, X, Sparkles, Zap, Crown, Loader2, Minus } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { usePlan } from '@/hooks/usePlan';
import { billingService } from '@/services/billingService';
import { FEATURE_MATRIX, PLAN_PRICES } from '@/lib/plans';

const FEATURE_LABELS: Record<string, string> = {
  maxMembersPerTeam: 'unlimited team members',
  maxTeamsOwned: 'unlimited teams',
  aiMessagesPerMonth: 'a higher monthly AI message quota',
  maxBots: 'unlimited AI chatbots',
  customRoles: 'custom roles & permissions',
  timeTracking: 'time tracking',
  recurringTasks: 'recurring tasks',
  emailReminders: 'email reminders',
  advancedAnalytics: 'advanced analytics',
  export: 'CSV / PDF export',
  sso: 'SSO / SAML',
  auditLog: 'the audit log',
};

const cell = (val: string, accent = false) =>
  val === '—' ? (
    <Minus className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
  ) : val === 'Included' ? (
    <span className={accent ? 'text-brand-500' : 'text-emerald-500'}>
      <Check className="h-4 w-4" />
    </span>
  ) : (
    <span className={accent ? 'font-medium text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}>
      {val}
    </span>
  );

export const UpgradeModal = () => {
  const { upgrade, closeUpgrade, addToast } = useUIStore();
  const { plan, isBusiness, billingEnabled, team } = usePlan();
  const [loading, setLoading] = useState<'pro' | 'business' | null>(null);

  const reason = upgrade.feature ? FEATURE_LABELS[upgrade.feature] : null;

  const handleUpgrade = async (target: 'pro' | 'business') => {
    if (!billingEnabled || !team) {
      addToast({
        type: 'info',
        title: 'Upgrade',
        message: 'Self-serve billing is being set up. Contact us to enable a paid plan for your team.',
      });
      return;
    }
    setLoading(target);
    try {
      await billingService.checkout(team._id, target, 'monthly'); // redirects to Stripe
    } catch (err: any) {
      setLoading(null);
      addToast({
        type: 'error',
        title: "Couldn't start checkout",
        message: err?.response?.data?.message || 'Please try again in a moment.',
      });
    }
  };

  return (
    <AnimatePresence>
      {upgrade.isOpen && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeUpgrade} />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            {/* Hero */}
            <div className="gradient-brand relative overflow-hidden px-7 pt-7 pb-6">
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
              <button
                onClick={closeUpgrade}
                className="absolute right-4 top-4 rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                <Crown className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white">
                {isBusiness
                  ? "You're on TaskFlow Business"
                  : plan === 'pro'
                  ? 'Go further with Business'
                  : 'Upgrade your workspace'}
              </h2>
              <p className="mt-1.5 max-w-md text-sm leading-relaxed text-white/80">
                {isBusiness
                  ? 'Your team has every feature unlocked. Thanks for being a Business member.'
                  : reason
                  ? `Unlock ${reason} — and more.`
                  : 'Pick the plan that fits your team. Per-seat pricing, cancel anytime.'}
              </p>
            </div>

            {/* Three-tier comparison */}
            <div className="max-h-[42vh] overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 text-sm">
                <div />
                <div className="pb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">Free</div>
                <div className="pb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Pro</div>
                <div className="flex items-center justify-center gap-1 pb-2 text-[11px] font-bold uppercase tracking-wide text-brand-500">
                  <Sparkles className="h-3 w-3" /> Business
                </div>

                {FEATURE_MATRIX.map((row) => (
                  <div key={row.label} className="contents">
                    <div className="border-t border-slate-100 py-2 text-slate-700 dark:border-slate-800 dark:text-slate-300">
                      {row.label}
                    </div>
                    <div className="flex items-center justify-center border-t border-slate-100 py-2 text-center text-xs dark:border-slate-800">
                      {cell(row.free)}
                    </div>
                    <div className="flex items-center justify-center border-t border-slate-100 py-2 text-center text-xs dark:border-slate-800">
                      {cell(row.pro)}
                    </div>
                    <div className="flex items-center justify-center border-t border-slate-100 py-2 text-center text-xs dark:border-slate-800">
                      {cell(row.business, true)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer / CTAs */}
            <div className="border-t border-slate-100 px-7 py-5 dark:border-slate-800">
              {isBusiness ? (
                <button
                  onClick={closeUpgrade}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                >
                  <Check className="h-4 w-4" /> All set
                </button>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row">
                  {plan === 'free' && (
                    <button
                      onClick={() => handleUpgrade('pro')}
                      disabled={loading !== null}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-brand-300 py-3 text-sm font-semibold text-brand-600 transition-colors hover:bg-brand-50 disabled:opacity-70 dark:border-brand-500/40 dark:text-brand-400 dark:hover:bg-brand-500/10"
                    >
                      {loading === 'pro' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                      Pro · ${PLAN_PRICES.pro.monthly}/seat
                    </button>
                  )}
                  <button
                    onClick={() => handleUpgrade('business')}
                    disabled={loading !== null}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white shadow-ember transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
                    style={{ background: 'linear-gradient(135deg,#e8502e 0%,#f97316 55%,#fb923c 100%)' }}
                  >
                    {loading === 'business' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Business · ${PLAN_PRICES.business.monthly}/seat
                  </button>
                </div>
              )}
              {!isBusiness && (
                <p className="mt-2.5 text-center text-xs text-slate-400">Per seat · billed monthly · cancel anytime</p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
