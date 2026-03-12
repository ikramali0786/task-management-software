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
    messages: ChatMessage[],
    file?: File | null
  ): Promise<ChatMessage> => {
    // Strip client-only attachment metadata — only send role + content to API
    const stripped = messages.map((m) => ({ role: m.role, content: m.content }));

    if (file) {
      // Multipart/form-data when a file is attached
      const formData = new FormData();
      formData.append('teamId', teamId);
      formData.append('messages', JSON.stringify(stripped));
      formData.append('file', file, file.name);
      // Set Content-Type to undefined to remove the axios instance default
      // ('application/json'). This lets the browser set multipart/form-data
      // with the correct boundary automatically.
      const res = await api.post(`/chatbots/${chatbotId}/chat`, formData, {
        headers: { 'Content-Type': undefined },
      });
      return res.data.data.message as ChatMessage;
    }

    // Regular JSON request
    const res = await api.post(`/chatbots/${chatbotId}/chat`, { teamId, messages: stripped });
    return res.data.data.message as ChatMessage;
  },
};
