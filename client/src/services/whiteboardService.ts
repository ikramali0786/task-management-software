import api from './api';

export interface WhiteboardData { elements: any[]; updatedAt: string | null }

export const whiteboardService = {
  get: async (teamId: string): Promise<WhiteboardData> => {
    const res = await api.get('/whiteboard', { params: { teamId } });
    return res.data?.data as WhiteboardData;
  },
  save: async (teamId: string, elements: any[]): Promise<{ updatedAt: string }> => {
    const res = await api.put('/whiteboard', { elements }, { params: { teamId } });
    return res.data?.data;
  },
  // Upload an image to R2 via a short-lived pre-signed PUT, returns its public URL.
  uploadImage: async (teamId: string, file: File): Promise<string> => {
    const res = await api.post(
      '/whiteboard/image',
      { filename: file.name, contentType: file.type, size: file.size },
      { params: { teamId } }
    );
    const { uploadUrl, publicUrl } = res.data?.data as { uploadUrl: string; publicUrl: string };
    await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
    return publicUrl;
  },
};
