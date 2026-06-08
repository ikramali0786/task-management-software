import api from './api';
import { TaskPriority, TaskStatus } from '@/types';

export interface IntakeForm {
  id: string;
  token: string;
  title: string;
  intro: string;
  defaultPriority: TaskPriority;
  defaultStatus: TaskStatus;
  enabled: boolean;
  submissionCount: number;
  createdAt: string;
}

export interface FormInput {
  title: string;
  intro?: string;
  defaultPriority?: TaskPriority;
  defaultStatus?: TaskStatus;
}

export interface BoardShare { enabled: boolean; token: string | null }

export const sharingService = {
  listForms: async (teamId: string): Promise<IntakeForm[]> => {
    const res = await api.get(`/sharing/${teamId}/forms`);
    return res.data?.data?.forms ?? [];
  },
  createForm: async (teamId: string, body: FormInput): Promise<IntakeForm> => {
    const res = await api.post(`/sharing/${teamId}/forms`, body);
    return res.data?.data?.form;
  },
  updateForm: async (id: string, body: Partial<FormInput> & { enabled?: boolean }): Promise<IntakeForm> => {
    const res = await api.patch(`/sharing/forms/${id}`, body);
    return res.data?.data?.form;
  },
  deleteForm: async (id: string): Promise<void> => {
    await api.delete(`/sharing/forms/${id}`);
  },

  getBoard: async (teamId: string): Promise<BoardShare> => {
    const res = await api.get(`/sharing/${teamId}/board`);
    return res.data?.data?.board;
  },
  enableBoard: async (teamId: string): Promise<BoardShare> => {
    const res = await api.post(`/sharing/${teamId}/board`);
    return res.data?.data?.board;
  },
  disableBoard: async (teamId: string): Promise<BoardShare> => {
    const res = await api.delete(`/sharing/${teamId}/board`);
    return res.data?.data?.board;
  },
};
