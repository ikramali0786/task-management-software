import api from './api';

export type GoalStatus = 'on_track' | 'at_risk' | 'off_track' | 'achieved';

export interface KeyResult {
  id: string;
  title: string;
  current: number;
  target: number;
  unit: string;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  owner: { id: string; name?: string; avatar?: string | null } | null;
  status: GoalStatus;
  dueDate: string | null;
  keyResults: KeyResult[];
  progress: number;
  createdBy: string;
  createdAt: string;
}

export interface KeyResultInput { title: string; current?: number; target?: number; unit?: string }
export interface GoalInput {
  title: string;
  description?: string;
  ownerId?: string | null;
  status?: GoalStatus;
  dueDate?: string | null;
  keyResults?: KeyResultInput[];
}

export const goalService = {
  list: async (teamId: string): Promise<Goal[]> => {
    const res = await api.get('/goals', { params: { teamId } });
    return res.data?.data?.goals ?? [];
  },
  create: async (teamId: string, body: GoalInput): Promise<Goal> => {
    const res = await api.post('/goals', { teamId, ...body });
    return res.data?.data?.goal;
  },
  update: async (id: string, body: Partial<GoalInput>): Promise<Goal> => {
    const res = await api.patch(`/goals/${id}`, body);
    return res.data?.data?.goal;
  },
  remove: async (id: string): Promise<void> => {
    await api.delete(`/goals/${id}`);
  },
};

export const GOAL_STATUS_META: Record<GoalStatus, { label: string; color: string; bg: string }> = {
  on_track: { label: 'On track', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  at_risk: { label: 'At risk', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  off_track: { label: 'Off track', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  achieved: { label: 'Achieved', color: '#e8502e', bg: 'rgba(232,80,46,0.12)' },
};
