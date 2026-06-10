import { useState, useEffect, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Crown, Check, Sparkles, Zap, Minus } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useTeamStore } from '@/store/teamStore';
import { usePlan } from '@/hooks/usePlan';
import { billingService } from '@/services/billingService';
import { FEATURE_MATRIX, PLAN_PRICES, PLAN_LABELS } from '@/lib/plans';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

/* ─── Usage Meter ───────────────────────────────────────── */
const UsageMeter = ({ label, used, max }: { label: string; used: number; max: number | null }) => {
  const unlimited = max === null || !Number.isFinite(max);
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(1, max!)) * 100));
  const near = !unlimited && pct >= 80;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/40">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {used}<span className="text-slate-400"> / {unlimited ? '∞' : max}</span>
        </p>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
        <div
          className={cn('h-full rounded-full transition-all', unlimited ? 'bg-emerald-400' : near ? 'bg-amber-500' : 'bg-brand-500')}
          style={{ width: unlimited ? '100%' : `${pct}%`, opacity: unlimited ? 0.4 : 1 }}
        />
      </div>
    </div>
  );
};

/* ─── Plan comparison cell ──────────────────────────────── */
const comparisonCell = (value: string, accent: boolean) => {
  if (value === '—') return <Minus className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />;
  if (value === 'Included')
    return (
      <span className={cn('inline-flex h-5 w-5 items-center justify-center rounded-full', accent ? 'bg-brand-500 shadow-sm shadow-brand-500/30' : 'bg-emerald-500')}>
        <Check className="h-3 w-3 text-white" strokeWidth={3} />
      </span>
    );
  return <span className={accent ? 'font-medium text-slate-900 dark:text-slate-100' : ''}>{value}</span>;
};

export const BillingSettings = () => {
  const { addToast, openUpgrade } = useUIStore();
  const { plan, isPro, limits, aiUsed, memberUsage, billingEnabled, team } = usePlan();
  const fetchTeams = useTeamStore((s) => s.fetchTeams);
  const [searchParams, setSearchParams] = useSearchParams();
  const [portalLoading, setPortalLoading] = useState(false);

  // Handle the return from Stripe Checkout / Customer Portal.
  useEffect(() => {
    const status = searchParams.get('billing');
    if (!status) return;
    if (status === 'success') {
      addToast({ type: 'success', title: 'Welcome to Pro! 🎉', message: 'Your subscription is active.' });
      fetchTeams();
    } else if (status === 'cancelled') {
      addToast({ type: 'info', title: 'Checkout cancelled', message: 'No changes were made.' });
    } else if (status === 'portal') {
      fetchTeams();
    }
    searchParams.delete('billing');
    setSearchParams(searchParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManageBilling = async () => {
    if (!team) return;
    setPortalLoading(true);
    try {
      await billingService.portal(team._id);
    } catch (err: any) {
      setPortalLoading(false);
      addToast({ type: 'error', title: "Couldn't open billing portal", message: err?.response?.data?.message || 'Please try again.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Current plan card */}
      <div className="card overflow-hidden p-0">
        <div className={cn('flex items-center justify-between gap-4 px-6 py-5', isPro ? 'gradient-brand text-white' : 'bg-slate-50 dark:bg-slate-800/60')}>
          <div className="flex items-center gap-3">
            <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', isPro ? 'bg-white/15' : 'bg-brand-100 dark:bg-brand-500/15')}>
              <Crown className={cn('h-5 w-5', isPro ? 'text-white' : 'text-brand-500')} />
            </div>
            <div>
              <p className={cn('text-xs font-semibold uppercase tracking-wider', isPro ? 'text-white/70' : 'text-slate-400')}>Current plan</p>
              <p className={cn('text-lg font-bold', isPro ? 'text-white' : 'text-slate-900 dark:text-slate-100')}>TaskFlow {PLAN_LABELS[plan]}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isPro && team?.stripeCustomerId && billingEnabled && (
              <button onClick={handleManageBilling} disabled={portalLoading} className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/25 disabled:opacity-70">
                {portalLoading ? 'Opening…' : 'Manage billing'}
              </button>
            )}
            {plan === 'business' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
                <Check className="h-3.5 w-3.5" /> Active
              </span>
            ) : (
              <Button size="sm" variant={isPro ? 'secondary' : 'primary'} onClick={() => openUpgrade()}>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                {plan === 'pro' ? 'Upgrade to Business' : 'Upgrade'}
              </Button>
            )}
          </div>
        </div>

        {/* Usage meters (current team) */}
        {team && (
          <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2">
            <UsageMeter label="Team members" used={memberUsage.count} max={memberUsage.max} />
            <UsageMeter label="AI messages this month" used={aiUsed} max={limits.aiMessagesPerMonth} />
          </div>
        )}
      </div>

      {/* Feature comparison — three tiers */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Compare plans</h3>
        <p className="mb-4 mt-0.5 text-xs text-slate-400">
          Per-seat pricing — Pro ${PLAN_PRICES.pro.monthly}/seat·mo, Business ${PLAN_PRICES.business.monthly}/seat·mo.
        </p>

        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="grid grid-cols-[1fr_auto_auto_auto] text-sm">
            {/* Header row */}
            <div className="bg-slate-50/60 px-4 py-3 dark:bg-slate-800/40" />
            <div className="bg-slate-50/60 px-3 py-3 text-center dark:bg-slate-800/40">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Free</p>
              <p className="mt-0.5 text-[10px] text-slate-400">{plan === 'free' ? 'Your plan' : '$0'}</p>
            </div>
            <div className="bg-slate-50/60 px-4 py-3 text-center dark:bg-slate-800/40">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Pro</p>
              <p className="mt-0.5 text-[10px] text-slate-400">{plan === 'pro' ? 'Your plan' : `$${PLAN_PRICES.pro.monthly}/seat`}</p>
            </div>
            <div className="bg-brand-50 px-5 py-3 text-center dark:bg-brand-500/10">
              <p className="flex items-center justify-center gap-1 text-[11px] font-bold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                <Sparkles className="h-3 w-3" /> Business
              </p>
              <p className="mt-0.5 text-[10px] font-medium text-brand-500">{plan === 'business' ? 'Your plan' : `$${PLAN_PRICES.business.monthly}/seat`}</p>
            </div>

            {FEATURE_MATRIX.map((row, i) => {
              const newSection = i === 0 || FEATURE_MATRIX[i - 1].section !== row.section;
              return (
                <Fragment key={row.label}>
                  {newSection && (
                    <>
                      <div className="col-span-3 border-t border-slate-200 bg-slate-50/40 px-4 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:border-slate-800 dark:bg-slate-800/30">
                        {row.section}
                      </div>
                      <div className="border-t border-slate-200 bg-brand-50 dark:border-slate-800 dark:bg-brand-500/10" />
                    </>
                  )}
                  <div className="flex items-center border-t border-slate-100 px-4 py-2.5 text-slate-700 dark:border-slate-800/70 dark:text-slate-300">
                    {row.label}
                  </div>
                  <div className="flex items-center justify-center border-t border-slate-100 px-3 py-2.5 text-center text-xs text-slate-500 dark:border-slate-800/70 dark:text-slate-400">
                    {comparisonCell(row.free, false)}
                  </div>
                  <div className="flex items-center justify-center border-t border-slate-100 px-4 py-2.5 text-center text-xs text-slate-600 dark:border-slate-800/70 dark:text-slate-300">
                    {comparisonCell(row.pro, false)}
                  </div>
                  <div className="flex items-center justify-center border-t border-brand-100 bg-brand-50 px-5 py-2.5 text-center text-xs dark:border-brand-500/10 dark:bg-brand-500/10">
                    {comparisonCell(row.business, true)}
                  </div>
                </Fragment>
              );
            })}
          </div>
        </div>

        {plan !== 'business' && (
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={() => openUpgrade()}>
              <Zap className="mr-1.5 h-4 w-4" />
              {plan === 'pro'
                ? `Upgrade to Business — $${PLAN_PRICES.business.monthly}/seat·mo`
                : `Upgrade — from $${PLAN_PRICES.pro.monthly}/seat·mo`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
