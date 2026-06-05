import { describe, it, expect } from 'vitest';
import {
  resolvePermissions,
  hasPermission,
  assertPermission,
  canEditTask,
  canDeleteTask,
  BUILT_IN_PERMISSIONS,
} from '../permissions';

// Minimal team/task fixtures (only the fields the resolver reads).
const team = (overrides: any = {}) => ({
  owner: 'owner1',
  members: [
    { user: 'owner1', role: 'admin' },
    { user: 'mod1', role: 'moderator' },
    { user: 'mem1', role: 'member' },
    { user: 'view1', role: 'viewer' },
    { user: 'custom1', role: 'Lead' },
  ],
  customRoles: [
    {
      name: 'Lead',
      permissions: { ...BUILT_IN_PERMISSIONS.member, editAnyTask: true, deleteAnyTask: true },
    },
  ],
  ...overrides,
});

describe('resolvePermissions', () => {
  it('grants the owner every permission regardless of member role', () => {
    const p = resolvePermissions(team(), 'owner1');
    expect(p).toEqual(BUILT_IN_PERMISSIONS.owner);
    expect(p?.manageTeamSettings).toBe(true);
  });

  it('resolves built-in roles', () => {
    expect(resolvePermissions(team(), 'mod1')?.inviteMembers).toBe(true);
    expect(resolvePermissions(team(), 'mod1')?.manageMembers).toBe(false);
    expect(resolvePermissions(team(), 'mem1')?.editAnyTask).toBe(false);
    expect(resolvePermissions(team(), 'view1')?.createTask).toBe(false);
    expect(resolvePermissions(team(), 'view1')?.commentOnTasks).toBe(false);
  });

  it('resolves custom roles by name', () => {
    const p = resolvePermissions(team(), 'custom1');
    expect(p?.editAnyTask).toBe(true);
    expect(p?.deleteAnyTask).toBe(true);
  });

  it('returns null for non-members', () => {
    expect(resolvePermissions(team(), 'stranger')).toBeNull();
  });

  it('falls back to member permissions for an unknown role', () => {
    const t = team({ members: [{ user: 'x', role: 'ghost-role' }], customRoles: [] });
    expect(resolvePermissions(t, 'x')).toEqual(BUILT_IN_PERMISSIONS.member);
  });
});

describe('hasPermission / assertPermission', () => {
  it('hasPermission reflects the resolved set', () => {
    expect(hasPermission(team(), 'mem1', 'createTask')).toBe(true);
    expect(hasPermission(team(), 'view1', 'createTask')).toBe(false);
    expect(hasPermission(team(), 'stranger', 'createTask')).toBe(false);
  });

  it('assertPermission throws 403 PERMISSION_DENIED when missing', () => {
    expect(() => assertPermission(team(), 'view1', 'createTask')).toThrowError();
    try {
      assertPermission(team(), 'view1', 'createTask');
    } catch (e: any) {
      expect(e.statusCode).toBe(403);
      expect(e.code).toBe('PERMISSION_DENIED');
      expect(e.details?.permission).toBe('createTask');
    }
  });

  it('assertPermission passes silently when allowed', () => {
    expect(() => assertPermission(team(), 'mem1', 'createTask')).not.toThrow();
  });
});

describe('canEditTask / canDeleteTask (own vs any)', () => {
  const ownTask = { createdBy: 'mem1', assignees: [] };
  const assignedTask = { createdBy: 'owner1', assignees: ['mem1'] };
  const othersTask = { createdBy: 'owner1', assignees: ['someoneElse'] };

  it('member can edit their own / assigned tasks but not others', () => {
    expect(canEditTask(team(), 'mem1', ownTask)).toBe(true);
    expect(canEditTask(team(), 'mem1', assignedTask)).toBe(true);
    expect(canEditTask(team(), 'mem1', othersTask)).toBe(false);
  });

  it('moderator (editAnyTask) can edit any task', () => {
    expect(canEditTask(team(), 'mod1', othersTask)).toBe(true);
  });

  it('viewer can edit nothing', () => {
    expect(canEditTask(team(), 'view1', ownTask)).toBe(false);
  });

  it('member can delete own but not others; moderator can delete any', () => {
    expect(canDeleteTask(team(), 'mem1', ownTask)).toBe(true);
    expect(canDeleteTask(team(), 'mem1', othersTask)).toBe(false);
    expect(canDeleteTask(team(), 'mod1', othersTask)).toBe(true);
  });

  it('owner can edit and delete any task', () => {
    expect(canEditTask(team(), 'owner1', othersTask)).toBe(true);
    expect(canDeleteTask(team(), 'owner1', othersTask)).toBe(true);
  });
});
