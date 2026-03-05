import api from './api';
import { Task, TaskStats, WorkloadEntry, ProjectProgress } from '../types';

export const taskService = {
  getTasks: async (params: Record<string, string>) => {
    const res = await api.get('/tasks', { params });
    return res.data.data as { tasks: Task[]; total: number };
  },
  getTask: async (taskId: string) => {
    const res = await api.get(`/tasks/${taskId}`);
    return res.data.data.task as Task;
  },
  createTask: async (data: Partial<Task> & { teamId: string }) => {
    const res = await api.post('/tasks', data);
    return res.data.data.task as Task;
  },
  updateTask: async (taskId: string, data: Partial<Task>) => {
    const res = await api.patch(`/tasks/${taskId}`, data);
    return res.data.data.task as Task;
  },
  updateStatus: async (taskId: string, status: string) => {
    const res = await api.patch(`/tasks/${taskId}/status`, { status });
    return res.data.data.task as Task;
  },
  updatePosition: async (taskId: string, position: number, status?: string) => {
    const res = await api.patch(`/tasks/${taskId}/position`, { position, status });
    return res.data.data.task as Task;
  },
  deleteTask: async (taskId: string) => {
    await api.delete(`/tasks/${taskId}`);
  },
  getStats: async (teamId: string) => {
    const res = await api.get('/tasks/stats', { params: { teamId } });
    return res.data.data.stats as TaskStats;
  },
  getWorkload: async (teamId: string): Promise<{ workload: WorkloadEntry[]; projectProgress: ProjectProgress }> => {
    const res = await api.get('/tasks/workload', { params: { teamId } });
    return {
      workload: res.data.data.workload as WorkloadEntry[],
      projectProgress: res.data.data.projectProgress as ProjectProgress,
    };
  },
};
