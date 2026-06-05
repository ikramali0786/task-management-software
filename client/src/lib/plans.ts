import { Plan, PlanLimits } from '@/types';

/** Client mirror of the server plan limits — used for fallbacks and the
 *  billing/comparison UI. The server remains the source of truth for enforcement. */
export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    maxTeamsOwned: 1,
    maxMembersPerTeam: 5,
    aiMessagesPerMonth: 50,
    maxBots: 1,
    maxFileBytes: 5 * 1024 * 1024,
    activityHistoryDays: 14,
    features: {
      timeTracking: false,
      recurringTasks: false,
      customRoles: false,
      emailReminders: false,
      advancedAnalytics: false,
      export: false,
    },
  },
  pro: {
    maxTeamsOwned: null,
    maxMembersPerTeam: null,
    aiMessagesPerMonth: 2000,
    maxBots: null,
    maxFileBytes: 100 * 1024 * 1024,
    activityHistoryDays: null,
    features: {
      timeTracking: true,
      recurringTasks: true,
      customRoles: true,
      emailReminders: true,
      advancedAnalytics: true,
      export: true,
    },
  },
};

/** Human-readable feature rows for the billing comparison table. */
export const FEATURE_MATRIX: Array<{ section: string; label: string; free: string; pro: string }> = [
  { section: 'Workspace', label: 'Members per team', free: 'Up to 5', pro: 'Unlimited' },
  { section: 'Workspace', label: 'Teams', free: '1', pro: 'Unlimited' },
  { section: 'Workspace', label: 'Kanban boards & tasks', free: 'Unlimited', pro: 'Unlimited' },
  { section: 'AI & storage', label: 'AI chatbots', free: '1 bot · 50 msgs/mo', pro: 'Unlimited · 2,000 msgs/mo' },
  { section: 'AI & storage', label: 'File attachments', free: '5 MB / file', pro: '100 MB / file' },
  { section: 'AI & storage', label: 'Activity history', free: '14 days', pro: 'Full history' },
  { section: 'Productivity', label: 'Time tracking', free: '—', pro: 'Included' },
  { section: 'Productivity', label: 'Recurring tasks', free: '—', pro: 'Included' },
  { section: 'Productivity', label: 'Custom roles & permissions', free: '—', pro: 'Included' },
  { section: 'Reporting & alerts', label: 'Email reminders', free: '—', pro: 'Included' },
  { section: 'Reporting & alerts', label: 'Advanced analytics', free: '—', pro: 'Included' },
  { section: 'Reporting & alerts', label: 'CSV / PDF export', free: '—', pro: 'Included' },
];

export const PRO_PRICE = { monthly: 9, yearly: 90 };
