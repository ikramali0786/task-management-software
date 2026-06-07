import { Plan, PlanLimits } from '@/types';

/** Client mirror of the server plan limits — used for fallbacks and the
 *  billing/comparison UI. The server remains the source of truth for enforcement. */
const NO_FEATURES: PlanLimits['features'] = {
  timeTracking: false, recurringTasks: false, customRoles: false, emailReminders: false,
  advancedAnalytics: false, export: false, sso: false, auditLog: false, apiAccess: false,
  automations: false, customFields: false,
};

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    maxTeamsOwned: 1,
    maxMembersPerTeam: 5,
    aiMessagesPerMonth: 50,
    maxBots: 1,
    maxFileBytes: 5 * 1024 * 1024,
    activityHistoryDays: 14,
    features: { ...NO_FEATURES },
  },
  pro: {
    maxTeamsOwned: null,
    maxMembersPerTeam: null,
    aiMessagesPerMonth: 2000,
    maxBots: null,
    maxFileBytes: 100 * 1024 * 1024,
    activityHistoryDays: null,
    features: {
      ...NO_FEATURES,
      timeTracking: true,
      recurringTasks: true,
      customRoles: true,
      emailReminders: true,
      apiAccess: true,
      automations: true,
      customFields: true,
    },
  },
  business: {
    maxTeamsOwned: null,
    maxMembersPerTeam: null,
    aiMessagesPerMonth: 10000,
    maxBots: null,
    maxFileBytes: 250 * 1024 * 1024,
    activityHistoryDays: null,
    features: {
      timeTracking: true, recurringTasks: true, customRoles: true, emailReminders: true,
      advancedAnalytics: true, export: true, sso: true, auditLog: true, apiAccess: true,
      automations: true, customFields: true,
    },
  },
};

/** Per-seat prices (USD / seat / month). Yearly ≈ 10 months. */
export const PLAN_PRICES: Record<'pro' | 'business', { monthly: number; yearly: number }> = {
  pro: { monthly: 9, yearly: 90 },
  business: { monthly: 18, yearly: 180 },
};

export const PLAN_LABELS: Record<Plan, string> = {
  free: 'Free',
  pro: 'Pro',
  business: 'Business',
};

/** Feature comparison rows across all three tiers. */
export const FEATURE_MATRIX: Array<{
  section: string; label: string; free: string; pro: string; business: string;
}> = [
  { section: 'Workspace', label: 'Members per team', free: 'Up to 5', pro: 'Unlimited', business: 'Unlimited' },
  { section: 'Workspace', label: 'Teams', free: '1', pro: 'Unlimited', business: 'Unlimited' },
  { section: 'Workspace', label: 'Kanban boards & tasks', free: 'Unlimited', pro: 'Unlimited', business: 'Unlimited' },
  { section: 'AI & storage', label: 'AI chatbots', free: '1 bot · 50 msgs/mo', pro: 'Unlimited · 2,000/mo', business: 'Unlimited · 10,000/mo' },
  { section: 'AI & storage', label: 'File attachments', free: '5 MB / file', pro: '100 MB / file', business: '250 MB / file' },
  { section: 'AI & storage', label: 'Activity history', free: '14 days', pro: 'Full history', business: 'Full history' },
  { section: 'Productivity', label: 'Time tracking', free: '—', pro: 'Included', business: 'Included' },
  { section: 'Productivity', label: 'Recurring tasks', free: '—', pro: 'Included', business: 'Included' },
  { section: 'Productivity', label: 'Custom roles & permissions', free: '—', pro: 'Included', business: 'Included' },
  { section: 'Productivity', label: 'Email reminders', free: '—', pro: 'Included', business: 'Included' },
  { section: 'Productivity', label: 'API access & webhooks', free: '—', pro: 'Included', business: 'Included' },
  { section: 'Productivity', label: 'Automation rules', free: '—', pro: 'Included', business: 'Included' },
  { section: 'Productivity', label: 'Custom fields', free: '—', pro: 'Included', business: 'Included' },
  { section: 'Business', label: 'Advanced analytics', free: '—', pro: '—', business: 'Included' },
  { section: 'Business', label: 'CSV / PDF export', free: '—', pro: '—', business: 'Included' },
  { section: 'Business', label: 'SSO / SAML', free: '—', pro: '—', business: 'Included' },
  { section: 'Business', label: 'Audit log', free: '—', pro: '—', business: 'Included' },
  { section: 'Business', label: 'Priority support', free: '—', pro: '—', business: 'Included' },
];

/** @deprecated kept for back-compat; prefer PLAN_PRICES. */
export const PRO_PRICE = PLAN_PRICES.pro;
