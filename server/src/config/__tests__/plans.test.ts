import { describe, it, expect } from 'vitest';
import {
  resolveEffectivePlan,
  isCompPremiumEmail,
  planPayload,
  PLAN_LIMITS,
} from '../plans';

describe('isCompPremiumEmail', () => {
  it('recognises the default comp-premium founder email (case-insensitive)', () => {
    expect(isCompPremiumEmail('ikram.ali3811@gmail.com')).toBe(true);
    expect(isCompPremiumEmail('IKRAM.ALI3811@GMAIL.COM')).toBe(true);
  });

  it('rejects other emails and empty values', () => {
    expect(isCompPremiumEmail('someone@else.com')).toBe(false);
    expect(isCompPremiumEmail('')).toBe(false);
    expect(isCompPremiumEmail(null)).toBe(false);
    expect(isCompPremiumEmail(undefined)).toBe(false);
  });
});

describe('resolveEffectivePlan', () => {
  it('returns the stored team tier (pro / business)', () => {
    expect(resolveEffectivePlan({ storedPlan: 'pro' })).toBe('pro');
    expect(resolveEffectivePlan({ storedPlan: 'business' })).toBe('business');
  });

  it('grants the top tier (business) when the owner is comp-premium', () => {
    expect(
      resolveEffectivePlan({ storedPlan: 'free', ownerEmail: 'ikram.ali3811@gmail.com' })
    ).toBe('business');
  });

  it('grants the top tier (business) when the requester is comp-premium', () => {
    expect(
      resolveEffectivePlan({ storedPlan: 'free', requesterEmail: 'ikram.ali3811@gmail.com' })
    ).toBe('business');
  });

  it('defaults to free for a normal team and requester', () => {
    expect(
      resolveEffectivePlan({ storedPlan: 'free', ownerEmail: 'a@b.com', requesterEmail: 'c@d.com' })
    ).toBe('free');
    expect(resolveEffectivePlan({})).toBe('free');
  });
});

describe('plan limits & payload', () => {
  it('tiers ascend free < pro < business', () => {
    expect(PLAN_LIMITS.free.maxMembersPerTeam).toBeLessThan(PLAN_LIMITS.pro.maxMembersPerTeam);
    expect(PLAN_LIMITS.free.features.timeTracking).toBe(false);
    expect(PLAN_LIMITS.pro.features.timeTracking).toBe(true);
    // Business-only features are gated above Pro.
    expect(PLAN_LIMITS.pro.features.advancedAnalytics).toBe(false);
    expect(PLAN_LIMITS.business.features.advancedAnalytics).toBe(true);
    expect(PLAN_LIMITS.pro.features.sso).toBe(false);
    expect(PLAN_LIMITS.business.features.sso).toBe(true);
    // Developer API is a paid feature (Pro and Business), not Free.
    expect(PLAN_LIMITS.free.features.apiAccess).toBe(false);
    expect(PLAN_LIMITS.pro.features.apiAccess).toBe(true);
    expect(PLAN_LIMITS.business.features.apiAccess).toBe(true);
    expect(PLAN_LIMITS.business.aiMessagesPerMonth).toBeGreaterThan(PLAN_LIMITS.pro.aiMessagesPerMonth);
  });

  it('planPayload exposes isPro/isBusiness and serialises Infinity → null', () => {
    const free = planPayload('free');
    expect(free.isPro).toBe(false);
    expect(free.isBusiness).toBe(false);
    expect(free.limits.maxMembersPerTeam).toBe(5);

    const pro = planPayload('pro');
    expect(pro.isPro).toBe(true);
    expect(pro.isBusiness).toBe(false);
    expect(pro.limits.maxMembersPerTeam).toBeNull(); // Infinity → null

    const biz = planPayload('business');
    expect(biz.isPro).toBe(true); // Business includes the Pro baseline
    expect(biz.isBusiness).toBe(true);
  });
});
