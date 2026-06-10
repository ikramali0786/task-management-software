import api from './api';

export interface AdminStats {
  users: number;
  verifiedUsers: number;
  signups7: number;
  signups30: number;
  teams: number;
  tasks: number;
  paidTeams: number;
  byPlan: { free: number; pro: number; business: number };
}

export interface AdminUserRow {
  _id: string;
  name: string;
  email: string;
  username?: string;
  avatar: string | null;
  emailVerified: boolean;
  isActive: boolean;
  createdAt: string;
  lastSeenAt?: string;
  ownedTeams: number;
}

export interface AdminTeamSummary {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'pro' | 'business';
  planStatus: 'active' | 'past_due' | 'canceled';
  memberCount: number;
  isOwner: boolean;
  role: string | null;
  currentPeriodEnd: string | null;
}

export interface AdminUserDetail extends AdminUserRow {
  twoFactorEnabled?: boolean;
  timezone?: string;
  assignedTasks: number;
  teams: AdminTeamSummary[];
}

export const adminService = {
  stats: async (): Promise<AdminStats> => {
    const res = await api.get('/admin/stats');
    return res.data?.data?.stats;
  },
  listUsers: async (q: string, page = 1): Promise<{ users: AdminUserRow[]; total: number; page: number; pages: number }> => {
    const res = await api.get('/admin/users', { params: { q, page } });
    return res.data?.data;
  },
  getUser: async (userId: string): Promise<AdminUserDetail> => {
    const res = await api.get(`/admin/users/${userId}`);
    return res.data?.data?.user;
  },
  setTeamPlan: async (
    teamId: string,
    plan: 'free' | 'pro' | 'business',
    planStatus?: 'active' | 'past_due' | 'canceled'
  ): Promise<{ id: string; plan: string; planStatus: string }> => {
    const res = await api.patch(`/admin/teams/${teamId}/plan`, { plan, planStatus });
    return res.data?.data?.team;
  },
  resendVerification: async (userId: string): Promise<void> => {
    await api.post(`/admin/users/${userId}/resend-verification`);
  },
  forceVerify: async (userId: string): Promise<void> => {
    await api.post(`/admin/users/${userId}/verify`);
  },
};
