import api from './api';
import { Discussion } from '../types';

export const discussionService = {
  getDiscussions: async (teamId: string): Promise<Discussion[]> => {
    const res = await api.get('/discussions', { params: { teamId } });
    return res.data.data.discussions as Discussion[];
  },

  createDiscussion: async (data: {
    teamId: string;
    body: string;
    parentDiscussionId?: string | null;
    mentionedUserIds?: string[];
  }): Promise<Discussion> => {
    const res = await api.post('/discussions', data);
    return res.data.data.discussion as Discussion;
  },

  updateDiscussion: async (id: string, body: string): Promise<Discussion> => {
    const res = await api.patch(`/discussions/${id}`, { body });
    return res.data.data.discussion as Discussion;
  },

  deleteDiscussion: async (id: string): Promise<void> => {
    await api.delete(`/discussions/${id}`);
  },

  togglePin: async (id: string): Promise<{ isPinned: boolean }> => {
    const res = await api.patch(`/discussions/${id}/pin`);
    return res.data.data;
  },
};
