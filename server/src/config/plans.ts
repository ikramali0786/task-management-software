import { env } from './env';

/**
 * Subscription plans — single source of truth for tiering.
 *
 * A team carries a stored `plan` ('free' | 'pro'). The *effective* plan is
 * resolved at request time and is Pro when ANY of these hold:
 *   • the team's stored plan is 'pro' (a real/Stripe subscription), or
 *   • the team owner is a complimentary-premium account, or
 *   • the requesting user is a complimentary-premium account.
 *
 * Complimentary accounts (env PREMIUM_EMAILS, default the founder) always get
 * Pro without any Stripe subscription.
 */

export type Plan = 'free' | 'pro';

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
  };
}

const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    maxTeamsOwned: 1,
    maxMembersPerTeam: 5,
    aiMessagesPerMonth: 50,
    maxBots: 1,
    maxFileBytes: 5 * MB,
    activityHistoryDays: 14,
    features: {
      timeTracking: false,
      recurringTasks: false,
      customRoles: false,
      emailReminders: false,
      advancedAnalytics: false,
      export: false,
    },
  },
  pro: {
    maxTeamsOwned: Infinity,
    maxMembersPerTeam: Infinity,
    aiMessagesPerMonth: 2000,
    maxBots: Infinity,
    maxFileBytes: 100 * MB,
    activityHistoryDays: Infinity,
    features: {
      timeTracking: true,
      recurringTasks: true,
      customRoles: true,
      emailReminders: true,
      advancedAnalytics: true,
      export: true,
    },
  },
};

export type PlanFeature = keyof PlanLimits['features'];

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

export const resolveEffectivePlan = ({
  storedPlan,
  ownerEmail,
  requesterEmail,
}: ResolveInput): Plan => {
  if (storedPlan === 'pro') return 'pro';
  if (isCompPremiumEmail(ownerEmail)) return 'pro';
  if (isCompPremiumEmail(requesterEmail)) return 'pro';
  return 'free';
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
  isPro: plan === 'pro',
  limits: jsonLimits(PLAN_LIMITS[plan]),
});
