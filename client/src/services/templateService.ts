import api from './api';
import { Task, TaskPriority, TaskStatus } from '@/types';

export interface TaskTemplate {
  id: string;
  name: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  labels: Array<{ name: string; color: string }>;
  estimatedMinutes: number | null;
  subtasks: string[];
  createdAt: string;
}

export interface TemplateInput {
  name: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  labels?: Array<{ name: string; color: string }>;
  estimatedMinutes?: number | null;
  subtasks?: string[];
}

export const templateService = {
  list: async (teamId: string): Promise<TaskTemplate[]> => {
    const res = await api.get('/templates', { params: { teamId } });
    return res.data?.data?.templates ?? [];
  },
  create: async (body: TemplateInput & { teamId: string }): Promise<TaskTemplate> => {
    const res = await api.post('/templates', body);
    return res.data?.data?.template;
  },
  update: async (id: string, body: Partial<TemplateInput>): Promise<TaskTemplate> => {
    const res = await api.patch(`/templates/${id}`, body);
    return res.data?.data?.template;
  },
  remove: async (id: string): Promise<void> => {
    await api.delete(`/templates/${id}`);
  },
  use: async (id: string, status?: TaskStatus): Promise<Task> => {
    const res = await api.post(`/templates/${id}/use`, status ? { status } : {});
    return res.data?.data?.task as Task;
  },
};
