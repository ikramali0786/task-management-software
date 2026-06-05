import { useMemo } from 'react';
import { useTeamStore } from '@/store/teamStore';
import { PLAN_LIMITS } from '@/lib/plans';
import { Plan, PlanFeature, PlanLimits, Team } from '@/types';

interface UsePlan {
  plan: Plan;
  isPro: boolean;
  limits: PlanLimits;
  /** True when the active team's plan unlocks the given feature. */
  can: (feature: PlanFeature) => boolean;
  /** AI messages used this month on the active team. */
  aiUsed: number;
  /** Member count vs cap (null cap = unlimited). */
  memberUsage: { count: number; max: number | null };
  team: Team | null;
}

/**
 * Resolve the current (active team's) subscription plan for gating UI.
 * The server attaches `plan`/`isPro`/`limits` to team objects; we read those and
 * fall back to the Free tier when absent.
 */
export const usePlan = (): UsePlan => {
  const team = useTeamStore((s) => s.activeTeam);

  return useMemo(() => {
    const plan: Plan = team?.isPro || team?.plan === 'pro' ? 'pro' : 'free';
    const limits = team?.limits ?? PLAN_LIMITS[plan];
    return {
      plan,
      isPro: plan === 'pro',
      limits,
      can: (feature: PlanFeature) => Boolean(limits.features?.[feature]),
      aiUsed: team?.aiUsage?.count ?? 0,
      memberUsage: { count: team?.members?.length ?? 0, max: limits.maxMembersPerTeam ?? null },
      team: team ?? null,
    };
  }, [team]);
};
