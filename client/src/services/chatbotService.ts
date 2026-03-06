import api from './api';
import { Chatbot, ChatMessage } from '../types';

export const chatbotService = {
  getChatbots: async (teamId: string): Promise<Chatbot[]> => {
    const res = await api.get('/chatbots', { params: { teamId } });
    return res.data.data.chatbots as Chatbot[];
  },
  createChatbot: async (data: {
    teamId: string; name: string; description?: string;
    systemPrompt?: string; model?: string; icon?: string; color?: string;
  }): Promise<Chatbot> => {
    const res = await api.post('/chatbots', data);
    return res.data.data.chatbot as Chatbot;
  },
  updateChatbot: async (chatbotId: string, data: Partial<Chatbot>): Promise<Chatbot> => {
    const res = await api.patch(`/chatbots/${chatbotId}`, data);
    return res.data.data.chatbot as Chatbot;
  },
  deleteChatbot: async (chatbotId: string): Promise<void> => {
    await api.delete(`/chatbots/${chatbotId}`);
  },
  sendMessage: async (
    chatbotId: string,
    teamId: string,
    messages: ChatMessage[]
  ): Promise<ChatMessage> => {
    const res = await api.post(`/chatbots/${chatbotId}/chat`, { teamId, messages });
    return res.data.data.message as ChatMessage;
  },
};
