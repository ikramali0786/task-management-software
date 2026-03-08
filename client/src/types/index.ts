export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';
export type UserRole = 'owner' | 'admin' | 'moderator' | 'member' | 'viewer' | string;
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

export interface RolePermissions {
  createTask: boolean;
  editOwnTask: boolean;
  editAnyTask: boolean;
  deleteOwnTask: boolean;
  deleteAnyTask: boolean;
  manageMembers: boolean;
  manageTeamSettings: boolean;
  inviteMembers: boolean;
  commentOnTasks: boolean;
  viewWorkload: boolean;
}

export interface CustomRole {
  _id: string;
  name: string;
  color: string;
  permissions: RolePermissions;
}

export interface TeamMember {
  user: User;
  role: string;
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
  customRoles: CustomRole[];
  createdAt: string;
}

export interface TaskLabel {
  _id?: string;
  name: string;
  color: string;
}

export interface TeamLabel {
  _id: string;
  name: string;
  color: string;
}

export interface Subtask {
  _id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DependencyTask {
  _id: string;
  title: string;
  identifier?: number;
  status: TaskStatus;
}

export interface TimeEntry {
  _id: string;
  user: { _id: string; name: string; avatar: string | null } | null;
  minutes: number;
  note: string;
  loggedAt: string;
}

export interface Task {
  _id: string;
  identifier?: number;     // per-team sequential ID, e.g. 1, 2, 3
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
  subtasks: Subtask[];
  timeEntries: TimeEntry[];
  estimatedMinutes: number | null;
  commentCount?: number;
  attachmentCount?: number;
  blockedBy?: DependencyTask[];
  blocks?: DependencyTask[];
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
  | 'member_joined'
  | 'mention';

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

export interface Comment {
  _id: string;
  task: string;
  author: User;
  body: string;
  parentComment: string | null;
  mentions: User[];
  editedAt: string | null;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  replies?: Comment[];
}

export interface WorkloadEntry {
  user: User;
  total: number;
  completedToday: number;
  statusBreakdown: { status: TaskStatus; count: number }[];
}

export interface ReactionGroup {
  emoji: string;
  count: number;
  users: string[];
  reacted: boolean;
}

export interface Discussion {
  _id: string;
  team: string;
  author: User;
  body: string;
  parentDiscussion: string | null;
  mentions: User[];
  editedAt: string | null;
  isDeleted: boolean;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  replies?: Discussion[];
}

export interface Attachment {
  _id: string;
  task: string;
  team: string;
  uploadedBy: User;
  filename: string;
  fileKey: string;
  publicUrl: string;
  contentType: string;
  size: number;           // bytes
  createdAt: string;
  updatedAt: string;
}

export interface ProjectProgress {
  total: number;
  done: number;
}

export interface TeamApiKey {
  keyHint: string;
  label: string;
  model: string;
  createdAt?: string;
}

export interface Chatbot {
  _id: string;
  team: string;
  name: string;
  description: string;
  systemPrompt: string;
  model: 'gpt-4o-mini' | 'gpt-4o' | 'gpt-3.5-turbo';
  icon: string;
  color: string;
  createdBy: User;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageAttachment {
  name: string;
  mimeType: string;
  previewUrl?: string; // object URL for image preview (client-side only)
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  attachment?: ChatMessageAttachment;
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
