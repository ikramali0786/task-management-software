import api from './api';
import { TeamApiKey } from '../types';

export const apiKeyService = {
  getKey: async (teamId: string): Promise<TeamApiKey | null> => {
    const res = await api.get(`/api-keys/${teamId}`);
    return res.data.data.apiKey as TeamApiKey | null;
  },
  setKey: async (teamId: string, data: { key: string; label?: string; model?: string }): Promise<TeamApiKey> => {
    const res = await api.post(`/api-keys/${teamId}`, data);
    return res.data.data.apiKey as TeamApiKey;
  },
  deleteKey: async (teamId: string): Promise<void> => {
    await api.delete(`/api-keys/${teamId}`);
  },
};
