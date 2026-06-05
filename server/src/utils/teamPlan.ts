import { User } from '../models/User.model';
import {
  Plan,
  PlanFeature,
  PLAN_LIMITS,
  resolveEffectivePlan,
  planPayload,
} from '../config/plans';
import { ApiError } from './ApiError';

/**
 * Helpers for resolving a team's *effective* subscription plan and enforcing
 * plan limits. The effective plan accounts for the stored team plan, the team
 * owner being a comp-premium account, and the requesting user being comp-premium.
 */

const ownerEmailOf = async (team: any): Promise<string | null> => {
  const owner = team?.owner;
  if (!owner) return null;
  // Populated owner doc with email.
  if (typeof owner === 'object' && 'email' in owner && owner.email) return owner.email as string;
  // Bare ObjectId — look it up.
  const u = await User.findById(owner).select('email').lean();
  return (u?.email as string) ?? null;
};

/** Resolve the effective plan for a team in the context of the requesting user. */
export const effectivePlan = async (
  team: any,
  requesterEmail?: string | null
): Promise<Plan> =>
  resolveEffectivePlan({
    storedPlan: team?.plan,
    ownerEmail: await ownerEmailOf(team),
    requesterEmail,
  });

/** team.toObject() merged with the plan payload (plan, isPro, limits). */
export const serializeTeam = async (team: any, requesterEmail?: string | null) => {
  const plan = await effectivePlan(team, requesterEmail);
  const obj = typeof team?.toObject === 'function' ? team.toObject() : team;
  return { ...obj, ...planPayload(plan) };
};

/** Serialize a list of teams (parallel). */
export const serializeTeams = async (teams: any[], requesterEmail?: string | null) =>
  Promise.all(teams.map((t) => serializeTeam(t, requesterEmail)));

/** Throw a 403 PLAN_LIMIT error if the team's plan lacks the given feature. */
export const assertFeature = async (
  team: any,
  feature: PlanFeature,
  requesterEmail?: string | null
): Promise<void> => {
  const plan = await effectivePlan(team, requesterEmail);
  if (!PLAN_LIMITS[plan].features[feature]) {
    throw new ApiError(403, 'This feature is only available on the Pro plan.', {
      code: 'PLAN_LIMIT',
      details: { feature, plan },
    });
  }
};

/** Throw a 403 PLAN_LIMIT error if adding a member would exceed the plan cap. */
export const assertMemberCapacity = async (
  team: any,
  requesterEmail?: string | null
): Promise<void> => {
  const plan = await effectivePlan(team, requesterEmail);
  const max = PLAN_LIMITS[plan].maxMembersPerTeam;
  if (Number.isFinite(max) && (team.members?.length ?? 0) >= max) {
    throw new ApiError(
      403,
      `Free teams are limited to ${max} members. Upgrade to Pro for unlimited members.`,
      { code: 'PLAN_LIMIT', details: { feature: 'maxMembersPerTeam', limit: max, plan } }
    );
  }
};

/**
 * Throw a 403 PLAN_LIMIT error if the user already owns the max number of teams
 * allowed by their plan. Comp-premium users (resolved via requesterEmail) are
 * unlimited.
 */
export const assertTeamCapacity = async (
  ownedCount: number,
  requesterEmail?: string | null
): Promise<void> => {
  const plan = resolveEffectivePlan({ requesterEmail });
  const max = PLAN_LIMITS[plan].maxTeamsOwned;
  if (Number.isFinite(max) && ownedCount >= max) {
    throw new ApiError(
      403,
      `The Free plan includes ${max} team. Upgrade to Pro to create more teams.`,
      { code: 'PLAN_LIMIT', details: { feature: 'maxTeamsOwned', limit: max, plan } }
    );
  }
};

/**
 * Atomically consume one AI message from the team's monthly quota.
 * Resets the meter at each calendar-month boundary. Throws PLAN_LIMIT when the
 * quota is exhausted. No-op increment for Pro (effectively unlimited cap).
 */
export const consumeAiMessage = async (team: any, requesterEmail?: string | null): Promise<void> => {
  const plan = await effectivePlan(team, requesterEmail);
  const limit = PLAN_LIMITS[plan].aiMessagesPerMonth;
  const month = new Date().toISOString().slice(0, 7); // 'YYYY-MM'

  // Roll over the meter on a new month.
  if (!team.aiUsage || team.aiUsage.month !== month) {
    team.aiUsage = { month, count: 0 };
  }

  if (team.aiUsage.count >= limit) {
    throw new ApiError(
      403,
      `You've reached this month's limit of ${limit} AI messages on the ${plan} plan. Upgrade to Pro for more.`,
      { code: 'PLAN_LIMIT', details: { feature: 'aiMessagesPerMonth', limit, plan } }
    );
  }

  team.aiUsage.count += 1;
  await team.save();
};
