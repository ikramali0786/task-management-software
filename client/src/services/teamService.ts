import api from './api';
import { Team } from '../types';

export const teamService = {
  getMyTeams: async () => {
    const res = await api.get('/teams');
    return res.data.data.teams as Team[];
  },
  getTeam: async (teamId: string) => {
    const res = await api.get(`/teams/${teamId}`);
    return res.data.data.team as Team;
  },
  createTeam: async (data: { name: string; description?: string }) => {
    const res = await api.post('/teams', data);
    return res.data.data.team as Team;
  },
  updateTeam: async (teamId: string, data: Partial<Team>) => {
    const res = await api.patch(`/teams/${teamId}`, data);
    return res.data.data.team as Team;
  },
  generateInviteCode: async (teamId: string) => {
    const res = await api.post(`/teams/${teamId}/invite`);
    return res.data.data as { inviteCode: string; expiresAt: string };
  },
  joinTeam: async (teamId: string, code: string) => {
    const res = await api.post(`/teams/${teamId}/join`, { code });
    return res.data.data.team as Team;
  },
  removeMember: async (teamId: string, userId: string) => {
    await api.delete(`/teams/${teamId}/members/${userId}`);
  },
  updateMemberRole: async (teamId: string, userId: string, role: string) => {
    await api.patch(`/teams/${teamId}/members/${userId}`, { role });
  },
  leaveTeam: async (teamId: string) => {
    await api.delete(`/teams/${teamId}/leave`);
  },
  // Join any team using only an invite code (no teamId needed)
  joinByCode: async (code: string) => {
    const res = await api.post('/teams/join', { code });
    return res.data.data.team as Team;
  },
  toggleLock: async (teamId: string) => {
    const res = await api.patch(`/teams/${teamId}/lock`);
    return res.data.data as { isLocked: boolean };
  },
};
