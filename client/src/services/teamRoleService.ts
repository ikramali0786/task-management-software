import api from './api';
import { CustomRole, RolePermissions } from '../types';

export interface BuiltInRole {
  _id: string;
  name: string;
  color: string;
  isBuiltIn: true;
  permissions: RolePermissions;
}

export const teamRoleService = {
  getRoles: async (teamId: string): Promise<{ builtIn: BuiltInRole[]; custom: CustomRole[] }> => {
    const res = await api.get(`/teams/${teamId}/roles`);
    return res.data.data;
  },

  createRole: async (teamId: string, data: { name: string; color: string; permissions: RolePermissions }): Promise<CustomRole[]> => {
    const res = await api.post(`/teams/${teamId}/roles`, data);
    return res.data.data.customRoles as CustomRole[];
  },

  updateRole: async (teamId: string, roleId: string, data: Partial<{ name: string; color: string; permissions: Partial<RolePermissions> }>): Promise<CustomRole[]> => {
    const res = await api.patch(`/teams/${teamId}/roles/${roleId}`, data);
    return res.data.data.customRoles as CustomRole[];
  },

  deleteRole: async (teamId: string, roleId: string): Promise<CustomRole[]> => {
    const res = await api.delete(`/teams/${teamId}/roles/${roleId}`);
    return res.data.data.customRoles as CustomRole[];
  },
};
