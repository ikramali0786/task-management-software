import api from './api';

export interface DocUser { _id: string; name: string; avatar: string | null }
export interface DocNode {
  _id: string;
  title: string;
  icon: string;
  parent: string | null;
  position: number;
  updatedAt: string;
  updatedBy?: DocUser | null;
}
export interface DocFull extends DocNode {
  content: string;
  isPublic: boolean;
  publicToken: string | null;
  createdBy?: DocUser | null;
  createdAt: string;
}
export interface DocSearchResult extends DocNode { snippet: string }
export interface DocPayload { title?: string; icon?: string; content?: string; parent?: string | null; position?: number }

export const docService = {
  list: async (teamId: string): Promise<DocNode[]> => {
    const res = await api.get('/docs', { params: { teamId } });
    return res.data?.data?.docs as DocNode[];
  },
  get: async (docId: string): Promise<DocFull> => {
    const res = await api.get(`/docs/${docId}`);
    return res.data?.data?.doc as DocFull;
  },
  create: async (teamId: string, payload: DocPayload = {}): Promise<DocFull> => {
    const res = await api.post('/docs', payload, { params: { teamId } });
    return res.data?.data?.doc as DocFull;
  },
  update: async (docId: string, payload: DocPayload): Promise<DocFull> => {
    const res = await api.patch(`/docs/${docId}`, payload);
    return res.data?.data?.doc as DocFull;
  },
  remove: async (docId: string): Promise<void> => { await api.delete(`/docs/${docId}`); },
  search: async (teamId: string, q: string): Promise<DocSearchResult[]> => {
    const res = await api.get('/docs/search', { params: { teamId, q } });
    return res.data?.data?.results as DocSearchResult[];
  },
  enableShare: async (docId: string): Promise<{ isPublic: boolean; publicToken: string }> => {
    const res = await api.post(`/docs/${docId}/share`);
    return res.data?.data;
  },
  disableShare: async (docId: string): Promise<{ isPublic: boolean; publicToken: string | null }> => {
    const res = await api.delete(`/docs/${docId}/share`);
    return res.data?.data;
  },
};
