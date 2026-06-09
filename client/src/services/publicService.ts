import api from './api';

export interface PublicFormInfo { title: string; intro: string; team: string }
export interface PublicBoardTask {
  id: string; identifier?: number; title: string; status: string; priority: string;
  dueDate: string | null; assignees: { name: string; avatar: string | null }[];
}
export interface PublicBoardData { team: string; tasks: PublicBoardTask[] }

export const publicService = {
  getForm: async (token: string): Promise<PublicFormInfo> => {
    const res = await api.get(`/public/forms/${token}`);
    return res.data?.data?.form;
  },
  submitForm: async (
    token: string,
    body: { name: string; email: string; summary: string; details?: string; company?: string }
  ): Promise<string> => {
    const res = await api.post(`/public/forms/${token}/submit`, body);
    return res.data?.message as string;
  },
  getBoard: async (token: string): Promise<PublicBoardData> => {
    const res = await api.get(`/public/boards/${token}`);
    return res.data?.data?.board;
  },
  getWhiteboard: async (token: string): Promise<PublicWhiteboardData> => {
    const res = await api.get(`/public/whiteboard/${token}`);
    return res.data?.data;
  },
  getDoc: async (token: string): Promise<PublicDocData> => {
    const res = await api.get(`/public/docs/${token}`);
    return res.data?.data;
  },
};

export interface PublicWhiteboardData { name: string; team: string; elements: any[]; updatedAt: string }
export interface PublicDocData { title: string; icon: string; content: string; team: string; updatedAt: string }
