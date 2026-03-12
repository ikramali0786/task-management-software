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
      // Use native fetch for file uploads:
      // 1. fetch sets multipart/form-data + boundary correctly (no Axios header conflict)
      // 2. 2-minute timeout — file processing + OpenAI call can exceed Axios's 30 s limit
      const formData = new FormData();
      formData.append('teamId', teamId);
      formData.append('messages', JSON.stringify(stripped));
      formData.append('file', file, file.name);

      const baseURL = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:5000/api';
      const token = localStorage.getItem('accessToken');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120_000); // 2 min

      let fetchRes: Response;
      try {
        fetchRes = await fetch(`${baseURL}/chatbots/${chatbotId}/chat`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: 'include',
          body: formData,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      const json = await fetchRes.json();
      if (!fetchRes.ok) {
        const err: any = new Error(json?.message || 'Request failed');
        err.response = { status: fetchRes.status, data: json };
        throw err;
      }
      return json.data.message as ChatMessage;
    }

    // Regular JSON request
    const res = await api.post(`/chatbots/${chatbotId}/chat`, { teamId, messages: stripped });
    return res.data.data.message as ChatMessage;
  },
};
