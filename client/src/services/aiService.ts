import api from './api';
import { TaskPriority, TaskStatus } from '@/types';

export interface TaskDraft {
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
}

export const aiService = {
  /** Turn a natural-language note into structured task fields. */
  parseTask: async (teamId: string, text: string): Promise<TaskDraft> => {
    const res = await api.post('/ai/parse-task', { teamId, text });
    return res.data?.data?.draft as TaskDraft;
  },
  /** Generate a standup-style Markdown summary of recent task activity. */
  summary: async (teamId: string, days?: number): Promise<string> => {
    const res = await api.post('/ai/summary', { teamId, ...(days ? { days } : {}) });
    return (res.data?.data?.summary as string) || '';
  },
};
