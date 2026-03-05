import api from './api';

export interface ReactionGroup {
  emoji: string;
  count: number;
  users: string[];
  reacted: boolean;
}

export const reactionService = {
  getReactions: async (resourceId: string): Promise<ReactionGroup[]> => {
    const res = await api.get('/reactions', { params: { resourceId } });
    return res.data.data.reactions as ReactionGroup[];
  },

  toggleReaction: async (data: {
    resourceId: string;
    resourceType: 'task' | 'comment' | 'discussion';
    emoji: string;
    teamId: string;
  }): Promise<{ reactions: ReactionGroup[]; added: boolean }> => {
    const res = await api.post('/reactions/toggle', data);
    return res.data.data;
  },
};
