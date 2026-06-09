import api from './api';

export interface BoardPreviewRect { x: number; y: number; w: number; h: number; c: string }
export interface BoardMeta {
  _id: string;
  name: string;
  preview: BoardPreviewRect[];
  elementCount: number;
  isPublic: boolean;
  publicToken: string | null;
  createdBy?: string | null;
  updatedAt: string;
  createdAt: string;
}
export interface SnapshotMeta {
  _id: string;
  label: string;
  createdBy?: { _id: string; name: string; avatar: string | null } | null;
  createdAt: string;
  elementCount: number;
}

export const whiteboardService = {
  // ── Boards ────────────────────────────────────────────────────────────────
  getBoards: async (teamId: string): Promise<BoardMeta[]> => {
    const res = await api.get('/whiteboard/boards', { params: { teamId } });
    return res.data?.data?.boards as BoardMeta[];
  },
  createBoard: async (teamId: string, payload: { name?: string; elements?: any[]; preview?: BoardPreviewRect[] }): Promise<BoardMeta> => {
    const res = await api.post('/whiteboard/boards', payload, { params: { teamId } });
    return res.data?.data?.board as BoardMeta;
  },
  renameBoard: async (boardId: string, name: string): Promise<BoardMeta> => {
    const res = await api.patch(`/whiteboard/boards/${boardId}`, { name });
    return res.data?.data?.board as BoardMeta;
  },
  deleteBoard: async (boardId: string): Promise<void> => { await api.delete(`/whiteboard/boards/${boardId}`); },

  // ── Board contents ──────────────────────────────────────────────────────────
  getBoard: async (boardId: string): Promise<{ elements: any[]; name: string; updatedAt: string }> => {
    const res = await api.get('/whiteboard', { params: { boardId } });
    return res.data?.data;
  },
  saveBoard: async (boardId: string, elements: any[], preview?: BoardPreviewRect[]): Promise<{ updatedAt: string }> => {
    const res = await api.put('/whiteboard', { elements, preview }, { params: { boardId } });
    return res.data?.data;
  },

  // ── Version history ─────────────────────────────────────────────────────────
  listSnapshots: async (boardId: string): Promise<SnapshotMeta[]> => {
    const res = await api.get(`/whiteboard/boards/${boardId}/snapshots`);
    return res.data?.data?.snapshots as SnapshotMeta[];
  },
  createSnapshot: async (boardId: string, label?: string): Promise<void> => { await api.post(`/whiteboard/boards/${boardId}/snapshots`, { label }); },
  restoreSnapshot: async (boardId: string, snapshotId: string): Promise<any[]> => {
    const res = await api.post(`/whiteboard/boards/${boardId}/snapshots/${snapshotId}/restore`);
    return res.data?.data?.elements as any[];
  },

  // ── Public share ────────────────────────────────────────────────────────────
  enableShare: async (boardId: string): Promise<{ isPublic: boolean; publicToken: string }> => {
    const res = await api.post(`/whiteboard/boards/${boardId}/share`);
    return res.data?.data;
  },
  disableShare: async (boardId: string): Promise<{ isPublic: boolean; publicToken: string | null }> => {
    const res = await api.delete(`/whiteboard/boards/${boardId}/share`);
    return res.data?.data;
  },

  // ── Images ────────────────────────────────────────────────────────────────
  uploadImage: async (teamId: string, file: File, boardId?: string): Promise<string> => {
    const res = await api.post('/whiteboard/image', { filename: file.name, contentType: file.type, size: file.size, boardId }, { params: { teamId } });
    const { uploadUrl, publicUrl } = res.data?.data as { uploadUrl: string; publicUrl: string };
    await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
    return publicUrl;
  },
};
