import api from './api';

export interface ContactPayload {
  name: string;
  email: string;
  subject: string;
  message: string;
  company?: string; // honeypot — must stay empty
}

export const supportService = {
  contact: async (payload: ContactPayload): Promise<string> => {
    const res = await api.post('/support/contact', payload);
    return res.data?.message as string;
  },
};
