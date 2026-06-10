import { describe, it, expect } from 'vitest';
import { assertFeature, assertMemberCapacity, assertTeamCapacity } from '../teamPlan';

/**
 * Plan-limit enforcement gates — the monetization-critical guards that stop
 * Free teams from using paid features or exceeding member/team caps.
 *
 * These helpers are async but DB-free here: each fixture carries a *populated*
 * owner ({ email }), so the effective-plan resolver reads the email directly
 * instead of hitting Mongoose. The comp-premium founder email
 * (ikram.ali3811@gmail.com, the env default) resolves to Business.
 */

const COMP_EMAIL = 'ikram.ali3811@gmail.com';
const NORMAL = 'normal@user.com';

// A team with a populated owner so ownerEmailOf() never touches the DB.
const team = (overrides: any = {}) => ({
  plan: 'free',
  owner: { email: NORMAL },
  members: [{ user: 'owner1', role: 'admin' }],
  ...overrides,
});

describe('assertFeature', () => {
  it('throws 403 PLAN_LIMIT when a Free team uses a paid feature', async () => {
    await expect(assertFeature(team(), 'export')).rejects.toMatchObject({
      statusCode: 403,
      code: 'PLAN_LIMIT',
    });
  });

  it('allows the feature when the stored plan includes it', async () => {
    await expect(assertFeature(team({ plan: 'business' }), 'export')).resolves.toBeUndefined();
    await expect(assertFeature(team({ plan: 'pro' }), 'automations')).resolves.toBeUndefined();
  });

  it('still gates a Business-only feature on a Pro team', async () => {
    await expect(assertFeature(team({ plan: 'pro' }), 'sso')).rejects.toMatchObject({
      code: 'PLAN_LIMIT',
    });
  });

  it('comp-premium requester unlocks any feature regardless of stored plan', async () => {
    await expect(assertFeature(team(), 'advancedAnalytics', COMP_EMAIL)).resolves.toBeUndefined();
  });

  it('comp-premium owner unlocks any feature', async () => {
    await expect(
      assertFeature(team({ owner: { email: COMP_EMAIL } }), 'sso')
    ).resolves.toBeUndefined();
  });
});

describe('assertMemberCapacity', () => {
  it('throws when a Free team is already at the 5-member cap', async () => {
    const full = team({ members: Array.from({ length: 5 }, (_, i) => ({ user: `u${i}` })) });
    await expect(assertMemberCapacity(full)).rejects.toMatchObject({
      statusCode: 403,
      code: 'PLAN_LIMIT',
      details: { feature: 'maxMembersPerTeam', limit: 5 },
    });
  });

  it('allows adding a member below the Free cap', async () => {
    const four = team({ members: Array.from({ length: 4 }, (_, i) => ({ user: `u${i}` })) });
    await expect(assertMemberCapacity(four)).resolves.toBeUndefined();
  });

  it('Pro/Business teams have no member cap', async () => {
    const big = team({ plan: 'pro', members: Array.from({ length: 50 }, (_, i) => ({ user: `u${i}` })) });
    await expect(assertMemberCapacity(big)).resolves.toBeUndefined();
  });

  it('comp-premium owner lifts the member cap', async () => {
    const full = team({
      owner: { email: COMP_EMAIL },
      members: Array.from({ length: 8 }, (_, i) => ({ user: `u${i}` })),
    });
    await expect(assertMemberCapacity(full)).resolves.toBeUndefined();
  });
});

describe('assertTeamCapacity', () => {
  it('throws once a Free user owns their 1 allowed team', async () => {
    await expect(assertTeamCapacity(1, NORMAL)).rejects.toMatchObject({
      statusCode: 403,
      code: 'PLAN_LIMIT',
      details: { feature: 'maxTeamsOwned', limit: 1 },
    });
  });

  it('allows a Free user to create their first team', async () => {
    await expect(assertTeamCapacity(0, NORMAL)).resolves.toBeUndefined();
  });

  it('comp-premium users can own unlimited teams', async () => {
    await expect(assertTeamCapacity(25, COMP_EMAIL)).resolves.toBeUndefined();
  });
});
