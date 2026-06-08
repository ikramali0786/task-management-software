import api from './api';

export interface WhiteboardData { elements: any[]; updatedAt: string | null }

export const whiteboardService = {
  get: async (teamId: string): Promise<WhiteboardData> => {
    const res = await api.get('/whiteboard', { params: { teamId } });
    return res.data?.data as WhiteboardData;
  },
  save: async (teamId: string, elements: any[]): Promise<{ updatedAt: string }> => {
    const res = await api.put('/whiteboard', { elements }, { params: { teamId } });
    return res.data?.data;
  },
};
