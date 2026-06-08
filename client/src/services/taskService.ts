import api from './api';
import { Task, TaskStats, WorkloadEntry, ProjectProgress, Subtask } from '../types';

export const taskService = {
  getTasks: async (params: Record<string, string>) => {
    const res = await api.get('/tasks', { params });
    return res.data.data as { tasks: Task[]; total: number };
  },
  getTask: async (taskId: string) => {
    const res = await api.get(`/tasks/${taskId}`);
    return res.data.data.task as Task;
  },
  // Cross-team quick search (Cmd+K). Returns lightweight task hits.
  search: async (q: string) => {
    const res = await api.get('/tasks/search', { params: { q } });
    return res.data.data.tasks as (Task & { teamName?: string })[];
  },
  // Meaning-based search within a team (embeddings). Returns ranked hits + score.
  semanticSearch: async (teamId: string, query: string) => {
    const res = await api.post('/tasks/semantic-search', { teamId, query });
    return res.data.data.results as Array<{
      _id: string; title: string; identifier?: number; status: string; priority: string; score: number;
    }>;
  },
  // Advanced analytics aggregates (Business feature).
  getAnalytics: async (teamId: string, days = 30) => {
    const res = await api.get('/tasks/analytics', { params: { teamId, days } });
    return res.data.data.analytics as {
      days: number;
      series: { date: string; created: number; completed: number }[];
      throughput: number;
      completionRate: number;
      avgCycleDays: number | null;
      byPriority: Record<string, number>;
      topContributors: { id: string; name: string; avatar: string | null; completed: number }[];
    };
  },
  // Download all team tasks as a CSV or PDF blob (Business feature).
  exportFile: async (teamId: string, format: 'csv' | 'pdf' = 'csv'): Promise<Blob> => {
    const res = await api.get('/tasks/export', { params: { teamId, format }, responseType: 'blob' });
    return res.data as Blob;
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
  addSubtask: async (taskId: string, title: string): Promise<Subtask[]> => {
    const res = await api.post(`/tasks/${taskId}/subtasks`, { title });
    return res.data.data.subtasks as Subtask[];
  },
  updateSubtask: async (taskId: string, subtaskId: string, data: { title?: string; completed?: boolean }): Promise<Subtask[]> => {
    const res = await api.patch(`/tasks/${taskId}/subtasks/${subtaskId}`, data);
    return res.data.data.subtasks as Subtask[];
  },
  deleteSubtask: async (taskId: string, subtaskId: string): Promise<Subtask[]> => {
    const res = await api.delete(`/tasks/${taskId}/subtasks/${subtaskId}`);
    return res.data.data.subtasks as Subtask[];
  },
  reorderSubtasks: async (taskId: string, subtaskIds: string[]): Promise<Subtask[]> => {
    const res = await api.patch(`/tasks/${taskId}/subtasks/reorder`, { subtaskIds });
    return res.data.data.subtasks as Subtask[];
  },
  addDependency: async (taskId: string, blockerId: string): Promise<Task> => {
    const res = await api.post(`/tasks/${taskId}/dependencies`, { blockerId });
    return res.data.data.task as Task;
  },
  removeDependency: async (taskId: string, blockerId: string): Promise<Task> => {
    const res = await api.delete(`/tasks/${taskId}/dependencies/${blockerId}`);
    return res.data.data.task as Task;
  },
};
