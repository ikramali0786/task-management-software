import { env } from './env';

/**
 * Subscription plans — single source of truth for tiering.
 *
 * Tiers ascend: free → pro → business. A team carries a stored `plan`; the
 * *effective* plan is resolved at request time and is the highest of:
 *   • the team's stored plan (a real/Stripe subscription),
 *   • Business if the owner or requester is a complimentary-premium account.
 *
 * Complimentary accounts (env PREMIUM_EMAILS, default the founder) get the top
 * tier without any Stripe subscription.
 */

export type Plan = 'free' | 'pro' | 'business';

export interface PlanLimits {
  /** Max teams a user may own. */
  maxTeamsOwned: number;
  /** Max members per team (incl. owner). */
  maxMembersPerTeam: number;
  /** AI chatbot messages per team per calendar month. */
  aiMessagesPerMonth: number;
  /** Max AI chatbots per team. */
  maxBots: number;
  /** Attachment size ceiling per file (bytes). */
  maxFileBytes: number;
  /** Days of activity history retained/visible. Infinity = full history. */
  activityHistoryDays: number;
  /** Feature flags unlocked on this tier. */
  features: {
    timeTracking: boolean;
    recurringTasks: boolean;
    customRoles: boolean;
    emailReminders: boolean;
    advancedAnalytics: boolean;
    export: boolean;
    sso: boolean;
    auditLog: boolean;
    /** Developer platform: REST API tokens + outbound webhooks. */
    apiAccess: boolean;
  };
}

const MB = 1024 * 1024;

const NO_FEATURES: PlanLimits['features'] = {
  timeTracking: false, recurringTasks: false, customRoles: false, emailReminders: false,
  advancedAnalytics: false, export: false, sso: false, auditLog: false, apiAccess: false,
};

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    maxTeamsOwned: 1,
    maxMembersPerTeam: 5,
    aiMessagesPerMonth: 50,
    maxBots: 1,
    maxFileBytes: 5 * MB,
    activityHistoryDays: 14,
    features: { ...NO_FEATURES },
  },
  pro: {
    maxTeamsOwned: Infinity,
    maxMembersPerTeam: Infinity,
    aiMessagesPerMonth: 2000,
    maxBots: Infinity,
    maxFileBytes: 100 * MB,
    activityHistoryDays: Infinity,
    features: {
      ...NO_FEATURES,
      timeTracking: true,
      recurringTasks: true,
      customRoles: true,
      emailReminders: true,
      apiAccess: true,
    },
  },
  business: {
    maxTeamsOwned: Infinity,
    maxMembersPerTeam: Infinity,
    aiMessagesPerMonth: 10000,
    maxBots: Infinity,
    maxFileBytes: 250 * MB,
    activityHistoryDays: Infinity,
    features: {
      timeTracking: true, recurringTasks: true, customRoles: true, emailReminders: true,
      advancedAnalytics: true, export: true, sso: true, auditLog: true, apiAccess: true,
    },
  },
};

export type PlanFeature = keyof PlanLimits['features'];

/** Tier rank for "highest wins" comparisons. */
export const PLAN_RANK: Record<Plan, number> = { free: 0, pro: 1, business: 2 };

// ── Complimentary premium accounts ───────────────────────────────────────────
const COMP_PREMIUM_EMAILS = new Set(
  env.PREMIUM_EMAILS.split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

export const isCompPremiumEmail = (email?: string | null): boolean =>
  !!email && COMP_PREMIUM_EMAILS.has(email.toLowerCase());

// ── Effective plan resolution ────────────────────────────────────────────────
interface ResolveInput {
  storedPlan?: string | null;
  ownerEmail?: string | null;
  requesterEmail?: string | null;
}

const asPlan = (v?: string | null): Plan =>
  v === 'pro' || v === 'business' ? v : 'free';

export const resolveEffectivePlan = ({
  storedPlan,
  ownerEmail,
  requesterEmail,
}: ResolveInput): Plan => {
  // Complimentary accounts get the top tier.
  if (isCompPremiumEmail(ownerEmail) || isCompPremiumEmail(requesterEmail)) return 'business';
  return asPlan(storedPlan);
};

/** JSON-safe limits (Infinity → null) for sending to the client. */
const jsonLimits = (l: PlanLimits) => ({
  ...l,
  maxTeamsOwned: Number.isFinite(l.maxTeamsOwned) ? l.maxTeamsOwned : null,
  maxMembersPerTeam: Number.isFinite(l.maxMembersPerTeam) ? l.maxMembersPerTeam : null,
  maxBots: Number.isFinite(l.maxBots) ? l.maxBots : null,
  activityHistoryDays: Number.isFinite(l.activityHistoryDays) ? l.activityHistoryDays : null,
});

/** The plan payload attached to team API responses. */
export const planPayload = (plan: Plan) => ({
  plan,
  isPro: plan !== 'free', // any paid tier has the Pro feature baseline
  isBusiness: plan === 'business',
  limits: jsonLimits(PLAN_LIMITS[plan]),
});
