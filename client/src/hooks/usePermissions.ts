import { useMemo } from 'react';
import { useTeamStore } from '@/store/teamStore';
import { useAuthStore } from '@/store/authStore';

/**
 * Client mirror of the server role-permission model (utils/permissions.ts).
 * Used to proactively hide/disable actions the current user can't perform on the
 * active team. The server remains the source of truth and enforces every action.
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
  createTask: true, editOwnTask: true, editAnyTask: true, deleteOwnTask: true,
  deleteAnyTask: true, manageMembers: true, manageTeamSettings: true,
  inviteMembers: true, commentOnTasks: true, viewWorkload: true,
};

const BUILT_IN: Record<string, RolePermissions> = {
  owner: ALL,
  admin: ALL,
  moderator: { ...ALL, manageMembers: false, manageTeamSettings: false },
  member: {
    createTask: true, editOwnTask: true, editAnyTask: false, deleteOwnTask: true,
    deleteAnyTask: false, manageMembers: false, manageTeamSettings: false,
    inviteMembers: false, commentOnTasks: true, viewWorkload: true,
  },
  viewer: {
    createTask: false, editOwnTask: false, editAnyTask: false, deleteOwnTask: false,
    deleteAnyTask: false, manageMembers: false, manageTeamSettings: false,
    inviteMembers: false, commentOnTasks: false, viewWorkload: true,
  },
};

interface UsePermissions {
  permissions: RolePermissions;
  can: (perm: Permission) => boolean;
  role: string | null;
  /** Can the user edit a given task (own-vs-any aware). */
  canEditTask: (task: { createdBy?: any; assignees?: any[] }) => boolean;
  canDeleteTask: (task: { createdBy?: any; assignees?: any[] }) => boolean;
}

const idOf = (v: any): string | undefined =>
  typeof v === 'string' ? v : v?._id ?? v?.id;

export const usePermissions = (): UsePermissions => {
  const team = useTeamStore((s) => s.activeTeam);
  const user = useAuthStore((s) => s.user);

  return useMemo(() => {
    const uid = user?._id;
    let permissions: RolePermissions = BUILT_IN.viewer;
    let role: string | null = null;

    if (team && uid) {
      if (idOf(team.owner) === uid) {
        permissions = BUILT_IN.owner;
        role = 'owner';
      } else {
        const member = team.members?.find((m) => idOf(m.user) === uid);
        role = member?.role ?? null;
        if (member) {
          permissions =
            BUILT_IN[member.role] ??
            (team.customRoles?.find((r) => r.name === member.role)?.permissions as RolePermissions) ??
            BUILT_IN.member;
        }
      }
    }

    const isOwnTask = (task: { createdBy?: any; assignees?: any[] }) =>
      idOf(task?.createdBy) === uid ||
      (task?.assignees || []).some((a) => idOf(a) === uid);

    return {
      permissions,
      role,
      can: (perm: Permission) => Boolean(permissions[perm]),
      canEditTask: (task) => permissions.editAnyTask || (permissions.editOwnTask && isOwnTask(task)),
      canDeleteTask: (task) => permissions.deleteAnyTask || (permissions.deleteOwnTask && isOwnTask(task)),
    };
  }, [team, user]);
};
