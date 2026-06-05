import api from './api';

export const billingService = {
  /** Start a Stripe Checkout session and redirect the browser to it. */
  checkout: async (teamId: string, interval: 'monthly' | 'yearly' = 'monthly') => {
    const res = await api.post(`/billing/${teamId}/checkout`, { interval });
    const url = res.data?.data?.url as string | undefined;
    if (url) window.location.href = url;
    return url;
  },

  /** Open the Stripe Customer Portal to manage/cancel the subscription. */
  portal: async (teamId: string) => {
    const res = await api.post(`/billing/${teamId}/portal`);
    const url = res.data?.data?.url as string | undefined;
    if (url) window.location.href = url;
    return url;
  },
};
