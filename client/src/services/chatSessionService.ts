import api from './api';
import { ChatMessage } from '../types';

// Strip client-only fields (previewUrl) before sending to the server
const stripLocal = (messages: ChatMessage[]) =>
  messages.map((m) => ({
    role: m.role,
    content: m.content,
    ...(m.attachment
      ? { attachment: { name: m.attachment.name, mimeType: m.attachment.mimeType } }
      : {}),
  }));

export const chatSessionService = {
  /**
   * Load the persisted chat history for a bot from R2.
   * Returns an empty array if the session doesn't exist yet.
   * Throws on network/server errors so the caller can fall back to localStorage.
   */
  load: async (botId: string, teamId: string): Promise<ChatMessage[]> => {
    const res = await api.get(`/chat-sessions/${botId}`, { params: { teamId } });
    return (res.data.data.messages ?? []) as ChatMessage[];
  },

  /**
   * Persist the full conversation to R2 (upsert).
   * Fire-and-forget — callers should not await this in the critical path.
   */
  save: async (botId: string, teamId: string, messages: ChatMessage[]): Promise<void> => {
    await api.put(`/chat-sessions/${botId}`, {
      teamId,
      messages: stripLocal(messages),
    });
  },

  /**
   * Delete the session from R2 (called when the user clicks "Clear").
   * Fire-and-forget — failures are silently ignored.
   */
  clear: async (botId: string, teamId: string): Promise<void> => {
    await api.delete(`/chat-sessions/${botId}`, { params: { teamId } });
  },
};
