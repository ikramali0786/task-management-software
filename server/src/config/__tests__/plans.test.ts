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
  it('returns pro when the stored team plan is pro', () => {
    expect(resolveEffectivePlan({ storedPlan: 'pro' })).toBe('pro');
  });

  it('returns pro when the owner is comp-premium', () => {
    expect(
      resolveEffectivePlan({ storedPlan: 'free', ownerEmail: 'ikram.ali3811@gmail.com' })
    ).toBe('pro');
  });

  it('returns pro when the requester is comp-premium', () => {
    expect(
      resolveEffectivePlan({ storedPlan: 'free', requesterEmail: 'ikram.ali3811@gmail.com' })
    ).toBe('pro');
  });

  it('defaults to free for a normal team and requester', () => {
    expect(
      resolveEffectivePlan({ storedPlan: 'free', ownerEmail: 'a@b.com', requesterEmail: 'c@d.com' })
    ).toBe('free');
    expect(resolveEffectivePlan({})).toBe('free');
  });
});

describe('plan limits & payload', () => {
  it('free is more restrictive than pro', () => {
    expect(PLAN_LIMITS.free.maxMembersPerTeam).toBeLessThan(
      PLAN_LIMITS.pro.maxMembersPerTeam
    );
    expect(PLAN_LIMITS.free.features.timeTracking).toBe(false);
    expect(PLAN_LIMITS.pro.features.timeTracking).toBe(true);
  });

  it('planPayload serialises Infinity limits to null for JSON', () => {
    const pro = planPayload('pro');
    expect(pro.isPro).toBe(true);
    expect(pro.limits.maxMembersPerTeam).toBeNull(); // Infinity → null
    const free = planPayload('free');
    expect(free.isPro).toBe(false);
    expect(free.limits.maxMembersPerTeam).toBe(5);
  });
});
