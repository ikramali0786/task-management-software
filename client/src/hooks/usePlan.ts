import { useMemo } from 'react';
import { useTeamStore } from '@/store/teamStore';
import { PLAN_LIMITS } from '@/lib/plans';
import { Plan, PlanFeature, PlanLimits, Team } from '@/types';

interface UsePlan {
  /** The active team's tier: 'free' | 'pro' | 'business'. */
  plan: Plan;
  /** True for any paid tier (Pro or Business). */
  isPro: boolean;
  /** True only on the Business tier. */
  isBusiness: boolean;
  limits: PlanLimits;
  /** True when the active team's plan unlocks the given feature. */
  can: (feature: PlanFeature) => boolean;
  /** AI messages used this month on the active team. */
  aiUsed: number;
  /** Member count vs cap (null cap = unlimited). */
  memberUsage: { count: number; max: number | null };
  /** True when Stripe self-serve checkout is live on the server. */
  billingEnabled: boolean;
  team: Team | null;
}

const toPlan = (v?: string | null): Plan => (v === 'pro' || v === 'business' ? v : 'free');

/**
 * Resolve the current (active team's) subscription tier for gating UI.
 * The server attaches `plan`/`isPro`/`isBusiness`/`limits` to team objects; we
 * read those and fall back to the Free tier when absent.
 */
export const usePlan = (): UsePlan => {
  const team = useTeamStore((s) => s.activeTeam);

  return useMemo(() => {
    const plan: Plan = team?.isBusiness ? 'business' : toPlan(team?.plan);
    const limits = team?.limits ?? PLAN_LIMITS[plan];
    return {
      plan,
      isPro: plan !== 'free',
      isBusiness: plan === 'business',
      limits,
      can: (feature: PlanFeature) => Boolean(limits.features?.[feature]),
      aiUsed: team?.aiUsage?.count ?? 0,
      memberUsage: { count: team?.members?.length ?? 0, max: limits.maxMembersPerTeam ?? null },
      billingEnabled: Boolean(team?.billingEnabled),
      team: team ?? null,
    };
  }, [team]);
};
