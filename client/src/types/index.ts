export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';
export type UserRole = 'owner' | 'admin' | 'moderator' | 'member' | 'viewer';
export type Theme = 'light' | 'dark' | 'system';

export interface User {
  _id: string;
  name: string;
  username?: string;
  email: string;
  avatar: string | null;
  timezone: string;
  theme: Theme;
  teams: Team[];
  lastSeenAt?: string;
  createdAt?: string;
}

export interface TaskActivity {
  _id: string;
  message: string;
  createdAt: string;
  icon?: 'task' | 'member';
}

export interface TeamMember {
  user: User;
  role: UserRole;
  joinedAt: string;
}

export interface Team {
  _id: string;
  name: string;
  description: string;
  slug: string;
  avatar: string | null;
  members: TeamMember[];
  owner: User;
  settings: {
    allowMemberInvite: boolean;
    isLocked: boolean;
    defaultTaskPriority: TaskPriority;
  };
  createdAt: string;
}

export interface TaskLabel {
  _id?: string;
  name: string;
  color: string;
}

export interface Task {
  _id: string;
  title: string;
  description: string;
  team: string | Team;
  createdBy: User;
  assignees: User[];
  status: TaskStatus;
  priority: TaskPriority;
  labels: TaskLabel[];
  dueDate: string | null;
  completedAt: string | null;
  position: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export type NotificationType =
  | 'task_assigned'
  | 'task_updated'
  | 'task_completed'
  | 'task_due_soon'
  | 'task_overdue'
  | 'team_invite'
  | 'member_joined';

export interface Notification {
  _id: string;
  recipient: string;
  actor: User;
  type: NotificationType;
  task: { _id: string; title: string } | null;
  team: { _id: string; name: string } | null;
  message: string;
  isRead: boolean;
  readAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface TaskStats {
  byStatus: Record<TaskStatus, number>;
  byPriority: Record<TaskPriority, number>;
  overdue: number;
}

export interface KanbanColumn {
  id: TaskStatus;
  title: string;
  color: string;
  taskIds: string[];
}

export const TASK_STATUSES: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'todo', label: 'To Do', color: '#94a3b8' },
  { id: 'in_progress', label: 'In Progress', color: '#6366f1' },
  { id: 'review', label: 'In Review', color: '#f59e0b' },
  { id: 'done', label: 'Done', color: '#22c55e' },
];

export const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bg: string }> = {
  urgent: { label: 'Urgent', color: '#ef4444', bg: 'bg-red-500/10 text-red-500' },
  high: { label: 'High', color: '#f97316', bg: 'bg-orange-500/10 text-orange-500' },
  medium: { label: 'Medium', color: '#6366f1', bg: 'bg-indigo-500/10 text-indigo-500' },
  low: { label: 'Low', color: '#94a3b8', bg: 'bg-slate-400/10 text-slate-400' },
};
