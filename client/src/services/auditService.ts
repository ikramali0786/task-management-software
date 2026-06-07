import api from './api';

export interface AuditEntry {
  id: string;
  action: string;
  actor: { id: string; name: string; avatar?: string } | null;
  target: { type?: string; id?: string; label?: string };
  meta: Record<string, any>;
  createdAt: string;
}

export interface AuditPage {
  logs: AuditEntry[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export const auditService = {
  list: async (
    teamId: string,
    opts: { page?: number; limit?: number; action?: string } = {}
  ): Promise<AuditPage> => {
    const res = await api.get('/audit', { params: { teamId, ...opts } });
    return res.data?.data as AuditPage;
  },
};

/** Human-readable labels for audit actions. */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'task.created': 'created a task',
  'task.updated': 'updated a task',
  'task.completed': 'completed a task',
  'task.deleted': 'deleted a task',
  'member.joined': 'joined the team',
  'member.left': 'left the team',
  'member.removed': 'removed a member',
  'role.updated': 'changed a member’s role',
  'billing.updated': 'billing was updated',
};

export const AUDIT_ACTION_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All activity' },
  { value: 'task.created', label: 'Tasks created' },
  { value: 'task.updated', label: 'Tasks updated' },
  { value: 'task.completed', label: 'Tasks completed' },
  { value: 'task.deleted', label: 'Tasks deleted' },
  { value: 'member.joined', label: 'Members joined' },
  { value: 'member.removed', label: 'Members removed' },
  { value: 'role.updated', label: 'Role changes' },
  { value: 'billing.updated', label: 'Billing changes' },
];
