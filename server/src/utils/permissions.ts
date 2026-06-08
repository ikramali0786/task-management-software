import { ApiError } from './ApiError';

/**
 * Role-based permission enforcement — the single source of truth.
 *
 * A team member's role is either a built-in role name (owner/admin/moderator/
 * member/viewer) or a custom role name (resolved from team.customRoles). The
 * team owner always has every permission. These maps mirror the BUILT_IN_ROLES
 * exposed by the roles API.
 */

export interface RolePermissions {
  createTask: boolean;
  editOwnTask: boolean;
  editAnyTask: boolean;
  deleteOwnTask: boolean;
  deleteAnyTask: boolean;
  manageMembers: boolean;
  manageTeamSettings: boolean;
  inviteMembers: boolean;
  commentOnTasks: boolean;
  viewWorkload: boolean;
}

export type Permission = keyof RolePermissions;

const ALL: RolePermissions = {
  createTask: true, editOwnTask: true, editAnyTask: true,
  deleteOwnTask: true, deleteAnyTask: true, manageMembers: true,
  manageTeamSettings: true, inviteMembers: true, commentOnTasks: true, viewWorkload: true,
};

export const BUILT_IN_PERMISSIONS: Record<string, RolePermissions> = {
  owner: ALL,
  admin: ALL,
  moderator: {
    createTask: true, editOwnTask: true, editAnyTask: true,
    deleteOwnTask: true, deleteAnyTask: true, manageMembers: false,
    manageTeamSettings: false, inviteMembers: true, commentOnTasks: true, viewWorkload: true,
  },
  member: {
    createTask: true, editOwnTask: true, editAnyTask: false,
    deleteOwnTask: true, deleteAnyTask: false, manageMembers: false,
    manageTeamSettings: false, inviteMembers: false, commentOnTasks: true, viewWorkload: true,
  },
  viewer: {
    createTask: false, editOwnTask: false, editAnyTask: false,
    deleteOwnTask: false, deleteAnyTask: false, manageMembers: false,
    manageTeamSettings: false, inviteMembers: false, commentOnTasks: false, viewWorkload: true,
  },
};

/** Resolve the effective permission set for a user on a team (null if not a member). */
export const resolvePermissions = (team: any, userId: string): RolePermissions | null => {
  if (!team) return null;
  if (team.owner?.toString() === userId) return BUILT_IN_PERMISSIONS.owner;
  const member = team.members?.find((m: any) => m.user.toString() === userId);
  if (!member) return null;
  // Guests are always read-only, regardless of their nominal role.
  if (member.isGuest) return BUILT_IN_PERMISSIONS.viewer;
  const builtIn = BUILT_IN_PERMISSIONS[member.role];
  if (builtIn) return builtIn;
  const custom = team.customRoles?.find((r: any) => r.name === member.role);
  if (custom?.permissions) return custom.permissions as RolePermissions;
  // Unknown/legacy role → fall back to the standard member permission set.
  return BUILT_IN_PERMISSIONS.member;
};

export const hasPermission = (team: any, userId: string, perm: Permission): boolean => {
  const p = resolvePermissions(team, userId);
  return !!p && !!p[perm];
};

/** Throw 403 PERMISSION_DENIED unless the user has the given permission. */
export const assertPermission = (
  team: any,
  userId: string,
  perm: Permission,
  message?: string
): void => {
  if (!hasPermission(team, userId, perm)) {
    throw new ApiError(403, message || 'You do not have permission to perform this action.', {
      code: 'PERMISSION_DENIED',
      details: { permission: perm },
    });
  }
};

// ── Task-scoped helpers (own vs any) ─────────────────────────────────────────
const isOwnTask = (task: any, userId: string): boolean =>
  task?.createdBy?.toString() === userId ||
  (task?.assignees || []).some((a: any) => a?.toString?.() === userId || a?._id?.toString?.() === userId);

export const canEditTask = (team: any, userId: string, task: any): boolean => {
  const p = resolvePermissions(team, userId);
  if (!p) return false;
  if (p.editAnyTask) return true;
  return p.editOwnTask && isOwnTask(task, userId);
};

export const canDeleteTask = (team: any, userId: string, task: any): boolean => {
  const p = resolvePermissions(team, userId);
  if (!p) return false;
  if (p.deleteAnyTask) return true;
  return p.deleteOwnTask && isOwnTask(task, userId);
};

export const assertCanEditTask = (team: any, userId: string, task: any): void => {
  if (!canEditTask(team, userId, task)) {
    throw new ApiError(403, "You don't have permission to edit this task.", {
      code: 'PERMISSION_DENIED',
      details: { permission: 'editTask' },
    });
  }
};

export const assertCanDeleteTask = (team: any, userId: string, task: any): void => {
  if (!canDeleteTask(team, userId, task)) {
    throw new ApiError(403, "You don't have permission to delete this task.", {
      code: 'PERMISSION_DENIED',
      details: { permission: 'deleteTask' },
    });
  }
};
