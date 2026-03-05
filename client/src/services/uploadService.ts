import api from './api';
import { Attachment } from '../types';

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export const uploadService = {
  /** Fetch all attachments for a task */
  getAttachments: async (taskId: string): Promise<Attachment[]> => {
    const res = await api.get(`/uploads/${taskId}`);
    return res.data.data as Attachment[];
  },

  /**
   * Upload a file to R2 via a two-step pre-signed URL flow:
   * 1. Ask our server for a short-lived PUT URL
   * 2. PUT the file directly to R2 (no server memory used)
   * 3. Tell our server to persist the metadata
   */
  uploadFile: async (
    file: File,
    taskId: string,
    teamId: string,
    onProgress?: (p: UploadProgress) => void
  ): Promise<Attachment> => {
    // Step 1 — get pre-signed upload URL
    const presignRes = await api.post('/uploads/presign', {
      filename: file.name,
      contentType: file.type,
      size: file.size,
      taskId,
    });
    const { uploadUrl, fileKey } = presignRes.data.data as {
      uploadUrl: string;
      fileKey: string;
      publicUrl: string;
    };

    // Step 2 — PUT directly to R2 with XHR so we can track upload progress
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress({
            loaded: e.loaded,
            total: e.total,
            percent: Math.round((e.loaded / e.total) * 100),
          });
        }
      });

      xhr.addEventListener('load', () => {
        // R2 returns 200 on success
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`R2 upload failed: ${xhr.status}`));
      });
      xhr.addEventListener('error', () => reject(new Error('R2 upload network error')));
      xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

      xhr.send(file);
    });

    // Step 3 — confirm metadata with our server
    const confirmRes = await api.post('/uploads/confirm', {
      fileKey,
      filename: file.name,
      size: file.size,
      contentType: file.type,
      taskId,
      teamId,
    });

    return confirmRes.data.data as Attachment;
  },

  /** Delete an attachment by ID */
  deleteAttachment: async (attachmentId: string): Promise<void> => {
    await api.delete(`/uploads/${attachmentId}`);
  },
};
