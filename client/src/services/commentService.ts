import api from './api';
import { Comment } from '../types';

export const commentService = {
  getComments: async (taskId: string): Promise<Comment[]> => {
    const res = await api.get('/comments', { params: { taskId } });
    return res.data.data.comments as Comment[];
  },

  createComment: async (data: {
    taskId: string;
    body: string;
    parentCommentId?: string | null;
    mentionedUserIds?: string[];
  }): Promise<Comment> => {
    const res = await api.post('/comments', data);
    return res.data.data.comment as Comment;
  },

  updateComment: async (commentId: string, body: string): Promise<Comment> => {
    const res = await api.patch(`/comments/${commentId}`, { body });
    return res.data.data.comment as Comment;
  },

  deleteComment: async (commentId: string): Promise<void> => {
    await api.delete(`/comments/${commentId}`);
  },
};
