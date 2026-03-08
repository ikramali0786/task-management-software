import api from './api';

export const labelService = {
  getLabels: async (teamId: string) =>
    (await api.get(`/teams/${teamId}/labels`)).data.data.labels,
  addLabel: async (teamId: string, name: string, color: string) =>
    (await api.post(`/teams/${teamId}/labels`, { name, color })).data.data.labels,
  updateLabel: async (teamId: string, labelId: string, data: { name?: string; color?: string }) =>
    (await api.patch(`/teams/${teamId}/labels/${labelId}`, data)).data.data.labels,
  deleteLabel: async (teamId: string, labelId: string) =>
    (await api.delete(`/teams/${teamId}/labels/${labelId}`)).data.data.labels,
};
