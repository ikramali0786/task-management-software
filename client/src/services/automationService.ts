import api from './api';

export type AutomationTrigger = 'task.created' | 'task.updated' | 'task.completed';
export type ConditionField = 'priority' | 'status' | 'titleContains' | 'unassigned';
export type ActionType = 'setPriority' | 'setStatus' | 'addLabel' | 'assignTo' | 'setDueInDays' | 'addComment';

export interface AutomationCondition { field: ConditionField; value: any }
export interface AutomationAction { type: ActionType; value: any }

export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  lastRunAt: string | null;
  runCount: number;
  createdAt: string;
}

export interface RuleInput {
  name: string;
  trigger: AutomationTrigger;
  conditions?: AutomationCondition[];
  actions: AutomationAction[];
  enabled?: boolean;
}

export const automationService = {
  list: async (teamId: string): Promise<AutomationRule[]> => {
    const res = await api.get('/automations', { params: { teamId } });
    return res.data?.data?.rules ?? [];
  },
  create: async (body: RuleInput & { teamId: string }): Promise<AutomationRule> => {
    const res = await api.post('/automations', body);
    return res.data?.data?.rule;
  },
  update: async (id: string, body: Partial<RuleInput>): Promise<AutomationRule> => {
    const res = await api.patch(`/automations/${id}`, body);
    return res.data?.data?.rule;
  },
  remove: async (id: string): Promise<void> => {
    await api.delete(`/automations/${id}`);
  },
};

export const TRIGGER_OPTIONS: { value: AutomationTrigger; label: string }[] = [
  { value: 'task.created', label: 'A task is created' },
  { value: 'task.updated', label: 'A task is updated' },
  { value: 'task.completed', label: 'A task is completed' },
];

export const CONDITION_OPTIONS: { value: ConditionField; label: string }[] = [
  { value: 'priority', label: 'Priority is' },
  { value: 'status', label: 'Status is' },
  { value: 'titleContains', label: 'Title contains' },
  { value: 'unassigned', label: 'Is unassigned' },
];

export const ACTION_OPTIONS: { value: ActionType; label: string }[] = [
  { value: 'setPriority', label: 'Set priority to' },
  { value: 'setStatus', label: 'Set status to' },
  { value: 'addLabel', label: 'Add label' },
  { value: 'assignTo', label: 'Assign to' },
  { value: 'setDueInDays', label: 'Set due date in (days)' },
  { value: 'addComment', label: 'Add comment' },
];

export const PRIORITY_VALUES = ['urgent', 'high', 'medium', 'low'] as const;
export const STATUS_VALUES = ['todo', 'in_progress', 'review', 'done'] as const;
