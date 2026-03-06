import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Copy, Check, UserPlus, Crown, Shield, Trash2, Lock, Unlock, Hash,
  Info, Edit2, Save, X, Eye, Zap, Users, LayoutGrid, MessageCircle,
  Settings, ChevronDown, Calendar, KeyRound, Bot, AlertTriangle,
} from 'lucide-react';
import { useTeamStore } from '@/store/teamStore';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { teamService } from '@/services/teamService';
import { taskService } from '@/services/taskService';
import { apiKeyService } from '@/services/apiKeyService';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { RolesManager } from '@/components/team/RolesManager';
import { DiscussionSection } from '@/components/team/DiscussionSection';
import { cn, formatLastSeen } from '@/lib/utils';
import { UserRole, TaskStats, TaskPriority, TeamApiKey } from '@/types';

type Tab = 'overview' | 'members' | 'discussions' | 'settings';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'discussions', label: 'Discussions', icon: MessageCircle },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const tabVariants = {
  enter: { opacity: 0, y: 8 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

// ── Role meta ─────────────────────────────────────────────────────────────────
const ROLE_META: Record<string, { label: string; description: string; color: string }> = {
  owner:     { label: 'Owner',     description: 'Full control — edit team, delete, transfer ownership.', color: 'text-amber-500' },
  admin:     { label: 'Admin',     description: 'Manage members, lock/unlock, generate invite codes.',   color: 'text-purple-500' },
  moderator: { label: 'Moderator', description: 'Create, edit, and delete any task.',                    color: 'text-blue-500' },
  member:    { label: 'Member',    description: 'Create tasks and edit tasks they created.',              color: 'text-slate-600' },
  viewer:    { label: 'Viewer',    description: 'View-only access — cannot create or edit tasks.',        color: 'text-slate-400' },
};

const ASSIGNABLE_ROLES: UserRole[] = ['admin', 'moderator', 'member', 'viewer'];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const STATUS_PILL_COLORS: Record<string, string> = {
  todo: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  in_progress: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300',
  review: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  done: 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-300',
};

const roleBadgeVariant = (role: string): 'warning' | 'info' | 'default' | 'danger' => {
  if (role === 'owner' || role === 'admin') return 'warning';
  if (role === 'moderator') return 'info';
  if (role === 'viewer') return 'danger';
  return 'default';
};

export const TeamPage = () => {
  const { activeTeam, fetchTeams, updateTeam } = useTeamStore();
  const { user } = useAuthStore();
  const { addToast, showConfirm } = useUIStore();

  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Overview
  const [stats, setStats] = useState<TaskStats | null>(null);

  // Invite code
  const [inviteCode, setInviteCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);

  // Join team
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  // Team lock
  const [togglingLock, setTogglingLock] = useState(false);

  // Roles info modal
  const [rolesOpen, setRolesOpen] = useState(false);

  // Team edit
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPriority, setEditPriority] = useState<TaskPriority>('medium');
  const [editAllowInvite, setEditAllowInvite] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);

  // Role dropdowns per member
  const [openRoleMenu, setOpenRoleMenu] = useState<string | null>(null);

  // API key
  const [apiKeyData, setApiKeyData] = useState<TeamApiKey | null>(null);
  const [apiKeyLoaded, setApiKeyLoaded] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeyLabel, setApiKeyLabel] = useState('');
  const [apiKeyModel, setApiKeyModel] = useState('gpt-4o-mini');
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [deletingApiKey, setDeletingApiKey] = useState(false);
  const [apiKeyError, setApiKeyError] = useState('');

  useEffect(() => {
    if (!activeTeam) return;
    taskService.getStats(activeTeam._id).then(setStats).catch(() => {});
  }, [activeTeam?._id]);

  // Sync edit fields when activeTeam changes
  useEffect(() => {
    if (!activeTeam) return;
    setEditName(activeTeam.name);
    setEditDesc(activeTeam.description || '');
    setEditPriority(activeTeam.settings?.defaultTaskPriority || 'medium');
    setEditAllowInvite(activeTeam.settings?.allowMemberInvite ?? true);
    // Reset API key state when team changes
    setApiKeyData(null);
    setApiKeyLoaded(false);
    setApiKeyInput('');
    setApiKeyLabel('');
    setApiKeyModel('gpt-4o-mini');
  }, [activeTeam?._id]);

  // Load API key when settings tab is opened (lazy)
  useEffect(() => {
    if (activeTab !== 'settings' || !activeTeam || apiKeyLoaded) return;
    apiKeyService.getKey(activeTeam._id)
      .then((k) => { setApiKeyData(k); if (k) setApiKeyModel(k.model); })
      .catch(() => {})
      .finally(() => setApiKeyLoaded(true));
  }, [activeTab, activeTeam?._id, apiKeyLoaded]);

  if (!activeTeam) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-slate-400">No team selected</p>
      </div>
    );
  }

  const currentMember = activeTeam.members.find((m) => m.user._id === user?._id);
  const isOwner = activeTeam.owner._id === user?._id;
  const isAdmin = isOwner || currentMember?.role === 'admin';
  const isLocked = activeTeam.settings?.isLocked ?? false;
  const members = activeTeam.members.map((m) => m.user);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleGenerateCode = async () => {
    setGeneratingCode(true);
    try {
      const { inviteCode: code } = await teamService.generateInviteCode(activeTeam._id);
      setInviteCode(code);
      addToast({ type: 'success', title: 'Invite code generated', message: 'Valid for 5 minutes!' });
    } catch {
      addToast({ type: 'error', title: 'Failed to generate invite code' });
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setJoining(true);
    try {
      await teamService.joinByCode(joinCode.trim());
      await fetchTeams();
      addToast({ type: 'success', title: 'Joined team!' });
      setJoinCode('');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Invalid or expired code';
      if (msg.toLowerCase().includes('locked')) {
        addToast({ type: 'error', title: 'Team is locked', message: 'Not accepting new members right now.' });
      } else {
        addToast({ type: 'error', title: msg });
      }
    } finally {
      setJoining(false);
    }
  };

  const handleToggleLock = async () => {
    setTogglingLock(true);
    try {
      const { isLocked: newLock } = await teamService.toggleLock(activeTeam._id);
      updateTeam(activeTeam._id, { settings: { ...activeTeam.settings, isLocked: newLock } });
      addToast({
        type: 'success',
        title: newLock ? 'Team locked' : 'Team unlocked',
      });
    } catch {
      addToast({ type: 'error', title: 'Failed to update lock' });
    } finally {
      setTogglingLock(false);
    }
  };

  const handleRemoveMember = async (userId: string, name: string) => {
    const ok = await showConfirm({
      title: 'Remove member',
      message: `Remove ${name} from the team? They will lose access to all team tasks.`,
      confirmLabel: 'Remove',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await teamService.removeMember(activeTeam._id, userId);
      await fetchTeams();
      addToast({ type: 'success', title: `${name} removed from team` });
    } catch {
      addToast({ type: 'error', title: 'Failed to remove member' });
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setOpenRoleMenu(null);
    try {
      await teamService.updateMemberRole(activeTeam._id, userId, newRole);
      await fetchTeams();
      addToast({ type: 'success', title: `Role updated to ${ROLE_META[newRole]?.label || newRole}` });
    } catch {
      addToast({ type: 'error', title: 'Failed to update role' });
    }
  };

  const handleSaveSettings = async () => {
    if (!editName.trim()) return;
    setSavingEdit(true);
    try {
      await teamService.updateTeam(activeTeam._id, {
        name: editName.trim(),
        description: editDesc.trim(),
        settings: {
          ...activeTeam.settings,
          defaultTaskPriority: editPriority,
          allowMemberInvite: editAllowInvite,
        },
      });
      await fetchTeams();
      addToast({ type: 'success', title: 'Team settings saved' });
    } catch {
      addToast({ type: 'error', title: 'Failed to save settings' });
    } finally {
      setSavingEdit(false);
    }
  };

  // ── API Key handlers ──────────────────────────────────────────────────────
  const handleSaveApiKey = async () => {
    if (!activeTeam || !apiKeyInput.trim()) return;
    if (!apiKeyInput.trim().startsWith('sk-')) {
      setApiKeyError('API key must start with "sk-"');
      return;
    }
    setApiKeyError('');
    setSavingApiKey(true);
    try {
      const saved = await apiKeyService.setKey(activeTeam._id, {
        key: apiKeyInput.trim(),
        label: apiKeyLabel.trim() || undefined,
        model: apiKeyModel,
      });
      setApiKeyData(saved);
      setApiKeyInput('');
      setApiKeyLabel('');
      addToast({ type: 'success', title: 'API key saved', message: 'Your OpenAI key has been encrypted and stored.' });
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to save API key';
      addToast({ type: 'error', title: msg });
    } finally {
      setSavingApiKey(false);
    }
  };

  const handleDeleteApiKey = async () => {
    if (!activeTeam) return;
    const ok = await showConfirm({
      title: 'Remove API Key',
      message: 'Remove the OpenAI API key? Chatbots will stop working until a new key is added.',
      confirmLabel: 'Remove',
      variant: 'danger',
    });
    if (!ok) return;
    setDeletingApiKey(true);
    try {
      await apiKeyService.deleteKey(activeTeam._id);
      setApiKeyData(null);
      setApiKeyInput('');
      addToast({ type: 'success', title: 'API key removed' });
    } catch {
      addToast({ type: 'error', title: 'Failed to remove API key' });
    } finally {
      setDeletingApiKey(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-5">
      {/* Team Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl gradient-brand text-2xl font-bold text-white shadow-sm">
          {activeTeam.name[0]}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white truncate">{activeTeam.name}</h2>
          <p className="text-sm text-slate-500 truncate">{activeTeam.description || 'No description'}</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {isOwner && <Badge variant="warning">Owner</Badge>}
          {!isOwner && isAdmin && <Badge variant="warning">Admin</Badge>}
          {isLocked && <Badge variant="danger">Locked</Badge>}
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/60">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all',
              activeTab === id
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:block">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          variants={tabVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.15 }}
        >

          {/* ── OVERVIEW ── */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Meta row */}
              <div className="card">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{activeTeam.members.length}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Members</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {stats ? (stats.byStatus['done'] || 0) : '—'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">Completed</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-500">{stats?.overdue ?? '—'}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Overdue</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {stats
                        ? Object.values(stats.byStatus).reduce((s, c) => s + c, 0)
                        : '—'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">Total Tasks</p>
                  </div>
                </div>
              </div>

              {/* Member Avatars */}
              <div className="card">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Team Members
                  </h3>
                  {isAdmin && (
                    <button
                      onClick={() => { setActiveTab('members'); setTimeout(handleGenerateCode, 100); }}
                      className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-600 font-medium"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Invite
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  {activeTeam.members.slice(0, 12).map((m) => (
                    <div key={m.user._id} className="flex flex-col items-center gap-1">
                      <Avatar name={m.user.name} src={m.user.avatar} size="md" />
                      <span className="text-xs text-slate-500 max-w-[48px] truncate text-center">{m.user.name.split(' ')[0]}</span>
                    </div>
                  ))}
                  {activeTeam.members.length > 12 && (
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500 dark:bg-slate-700">
                        +{activeTeam.members.length - 12}
                      </div>
                      <span className="text-xs text-slate-400">more</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Task status pills */}
              {stats && (
                <div className="card">
                  <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Task Status</h3>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: 'todo', label: 'To Do' },
                      { key: 'in_progress', label: 'In Progress' },
                      { key: 'review', label: 'In Review' },
                      { key: 'done', label: 'Done' },
                    ].map(({ key, label }) => (
                      <span
                        key={key}
                        className={cn('rounded-full px-3 py-1 text-xs font-semibold', STATUS_PILL_COLORS[key])}
                      >
                        {label}: {stats.byStatus[key as keyof typeof stats.byStatus] || 0}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Created date */}
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Calendar className="h-3.5 w-3.5" />
                Team created {new Date(activeTeam.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>
          )}

          {/* ── MEMBERS ── */}
          {activeTab === 'members' && (
            <div className="space-y-5">
              {/* Invite section (admins) */}
              {isAdmin && (
                <div className="card">
                  <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Invite Members</h3>
                  {isLocked && (
                    <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 dark:border-amber-800/40 dark:bg-amber-500/10">
                      <Lock className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        Team is locked — invite codes can be generated but new members can't join until unlocked.
                      </p>
                    </div>
                  )}
                  <div className="space-y-3">
                    <Button onClick={handleGenerateCode} isLoading={generatingCode} variant="secondary" className="gap-2">
                      <UserPlus className="h-4 w-4" />
                      Generate Invite Code
                    </Button>
                    <p className="text-xs text-slate-400">Codes expire after 5 minutes — share them quickly.</p>
                    {inviteCode && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 dark:border-brand-800 dark:bg-brand-500/10"
                      >
                        <code className="flex-1 font-mono text-sm text-brand-700 dark:text-brand-300 break-all">
                          {inviteCode}
                        </code>
                        <button
                          onClick={handleCopy}
                          className="flex-shrink-0 rounded-lg p-1.5 text-brand-500 hover:bg-brand-100 dark:hover:bg-brand-500/20"
                        >
                          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </motion.div>
                    )}
                  </div>
                </div>
              )}

              {/* Join another team */}
              <div className="card">
                <h3 className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">Join Another Team</h3>
                <p className="mb-3 text-xs text-slate-500">Have an invite code? Paste it below.</p>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Paste invite code..."
                      leftIcon={<Hash className="h-4 w-4" />}
                      value={joinCode}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setJoinCode(e.target.value)}
                      onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handleJoin()}
                    />
                  </div>
                  <Button onClick={handleJoin} isLoading={joining} className="flex-shrink-0">Join</Button>
                </div>
              </div>

              {/* Members list */}
              <div className="card">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Members ({activeTeam.members.length})
                  </h3>
                  <button
                    onClick={() => setRolesOpen(true)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
                  >
                    <Info className="h-3.5 w-3.5" />
                    Role guide
                  </button>
                </div>
                <div className="space-y-2">
                  {activeTeam.members.map((m) => {
                    const memberIsOwner = activeTeam.owner._id === m.user._id;
                    const isSelf = m.user._id === user?._id;
                    const displayRole = memberIsOwner ? 'owner' : m.role;

                    const { label: activeLabel, isActive } = formatLastSeen(m.user.lastSeenAt);

                    return (
                      <div
                        key={m.user._id}
                        className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800"
                      >
                        <div className="relative flex-shrink-0">
                          <Avatar name={m.user.name} src={m.user.avatar} size="md" />
                          <div
                            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900 ${
                              isActive ? 'bg-emerald-400' : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                              {m.user.name}
                              {isSelf && <span className="ml-1 text-xs text-slate-400">(you)</span>}
                            </p>
                            {memberIsOwner && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                          </div>
                          <p className="text-xs text-slate-400">{m.user.email}</p>
                          <p className={`text-xs font-medium ${isActive ? 'text-emerald-500' : 'text-slate-400'}`}>
                            {activeLabel}
                          </p>
                        </div>

                        <Badge variant={roleBadgeVariant(displayRole)}>
                          {ROLE_META[displayRole]?.label || displayRole}
                        </Badge>

                        {isAdmin && !isSelf && !memberIsOwner && (
                          <div className="flex items-center gap-1">
                            <div className="relative">
                              <button
                                onClick={() => setOpenRoleMenu(openRoleMenu === m.user._id ? null : m.user._id)}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 transition-colors"
                                title="Change role"
                              >
                                <Shield className="h-3.5 w-3.5" />
                              </button>
                              <AnimatePresence>
                                {openRoleMenu === m.user._id && (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                                    className="absolute right-0 z-20 mt-1 w-40 rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800"
                                  >
                                    {ASSIGNABLE_ROLES.map((role) => (
                                      <button
                                        key={role}
                                        onClick={() => handleRoleChange(m.user._id, role)}
                                        className={cn(
                                          'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-700',
                                          m.role === role ? 'font-semibold text-brand-600 dark:text-brand-400' : 'text-slate-700 dark:text-slate-200'
                                        )}
                                      >
                                        {ROLE_META[role]?.label}
                                        {m.role === role && <Check className="ml-auto h-3.5 w-3.5" />}
                                      </button>
                                    ))}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                            <button
                              onClick={() => handleRemoveMember(m.user._id, m.user.name)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 transition-colors"
                              title="Remove member"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Team Lock (admins) */}
              {isAdmin && (
                <div className="card">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {isLocked ? <Lock className="h-4 w-4 text-red-500" /> : <Unlock className="h-4 w-4 text-emerald-500" />}
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Team Lock</h3>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {isLocked
                          ? 'Locked — new members cannot join.'
                          : 'Unlocked — anyone with a valid invite code can join.'}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={handleToggleLock}
                      isLoading={togglingLock}
                      className={cn('flex-shrink-0 gap-2', isLocked && 'border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400')}
                    >
                      {isLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                      {isLocked ? 'Unlock' : 'Lock Team'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── DISCUSSIONS ── */}
          {activeTab === 'discussions' && (
            <div className="card">
              <DiscussionSection
                teamId={activeTeam._id}
                members={members}
                isAdmin={isAdmin}
              />
            </div>
          )}

          {/* ── SETTINGS ── */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              {!isAdmin ? (
                <div className="rounded-xl border border-slate-200 py-12 text-center dark:border-slate-700">
                  <Settings className="mx-auto mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
                  <p className="text-sm text-slate-400">Only admins can access team settings.</p>
                </div>
              ) : (
                <>
                  {/* Team info */}
                  <div className="card space-y-4">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <Edit2 className="h-4 w-4 text-brand-500" />
                      Team Info
                    </h3>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-500">Team Name</label>
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-500">Description</label>
                      <textarea
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        rows={2}
                        className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-500">Default Task Priority</label>
                      <div className="relative">
                        <select
                          value={editPriority}
                          onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
                          className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 pr-8 text-sm text-slate-800 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          {PRIORITY_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Allow Member Invites</p>
                        <p className="text-xs text-slate-400">Non-admins can generate invite codes</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditAllowInvite((v) => !v)}
                        className={cn(
                          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                          editAllowInvite ? 'bg-brand-500' : 'bg-slate-200 dark:bg-slate-700'
                        )}
                      >
                        <span className={cn(
                          'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform',
                          editAllowInvite ? 'translate-x-5' : 'translate-x-0'
                        )} />
                      </button>
                    </div>
                    <div>
                      <Button onClick={handleSaveSettings} isLoading={savingEdit} size="sm" className="gap-1.5">
                        <Save className="h-3.5 w-3.5" /> Save Settings
                      </Button>
                    </div>
                  </div>

                  {/* Custom Roles */}
                  <div className="card">
                    <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <Shield className="h-4 w-4 text-brand-500" />
                      Custom Roles
                    </h3>
                    <RolesManager teamId={activeTeam._id} isAdmin={isAdmin} />
                  </div>

                  {/* AI & API Keys */}
                  <div className="card space-y-4">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <Bot className="h-4 w-4 text-brand-500" />
                      AI &amp; API Keys
                    </h3>
                    <p className="text-xs text-slate-500">
                      Add your OpenAI API key to enable AI chatbots for this team. The key is encrypted at rest and never exposed.
                    </p>

                    {/* Current key status */}
                    {!apiKeyLoaded ? (
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <div className="h-3 w-3 animate-spin rounded-full border border-slate-400 border-t-transparent" />
                        Loading…
                      </div>
                    ) : apiKeyData ? (
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800/40 dark:bg-emerald-500/10">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <KeyRound className="h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 truncate">
                              {apiKeyData.label || 'OpenAI API Key'}
                            </p>
                            <p className="font-mono text-xs text-emerald-600 dark:text-emerald-400">
                              {apiKeyData.keyHint}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                            {apiKeyData.model}
                          </span>
                          <button
                            onClick={handleDeleteApiKey}
                            disabled={deletingApiKey}
                            className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
                            title="Remove API key"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-500" />
                        <p className="text-sm text-slate-500 dark:text-slate-400">No API key configured — chatbots won't work.</p>
                      </div>
                    )}

                    {/* Set / Replace key form */}
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-slate-500">
                          {apiKeyData ? 'Replace API Key' : 'Add API Key'}
                        </label>
                        <div className="relative">
                          <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type="password"
                            placeholder="sk-..."
                            value={apiKeyInput}
                            onChange={(e) => { setApiKeyInput(e.target.value); setApiKeyError(''); }}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm text-slate-800 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          />
                        </div>
                        {apiKeyError && (
                          <p className="mt-1 text-xs text-red-500">{apiKeyError}</p>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-500">Label (optional)</label>
                          <input
                            type="text"
                            placeholder="e.g. Production Key"
                            value={apiKeyLabel}
                            onChange={(e) => setApiKeyLabel(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-500">Default Model</label>
                          <div className="relative">
                            <select
                              value={apiKeyModel}
                              onChange={(e) => setApiKeyModel(e.target.value)}
                              className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 pr-8 text-sm text-slate-800 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                              <option value="gpt-4o-mini">GPT-4o Mini</option>
                              <option value="gpt-4o">GPT-4o</option>
                              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          </div>
                        </div>
                      </div>
                      <Button
                        onClick={handleSaveApiKey}
                        isLoading={savingApiKey}
                        disabled={!apiKeyInput.trim()}
                        size="sm"
                        className="gap-1.5"
                      >
                        <Save className="h-3.5 w-3.5" />
                        {apiKeyData ? 'Replace Key' : 'Save Key'}
                      </Button>
                    </div>
                  </div>

                  {/* Danger zone */}
                  <div className="card border border-red-100 dark:border-red-900/30">
                    <h3 className="mb-3 text-sm font-semibold text-red-600 dark:text-red-400">Danger Zone</h3>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Archive Team</p>
                        <p className="text-xs text-slate-400">Hides the team from all members. Cannot be undone easily.</p>
                      </div>
                      <button
                        disabled
                        title="Feature coming in a future update"
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-400 opacity-50 cursor-not-allowed dark:border-red-800"
                      >
                        Archive Team
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Roles Info Modal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {rolesOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRolesOpen(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">Role Permissions</h3>
                <button
                  onClick={() => setRolesOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3">
                {Object.entries(ROLE_META).map(([role, meta]) => (
                  <div key={role} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                    <div className="mt-0.5">
                      {role === 'owner' && <Crown className={cn('h-4 w-4', meta.color)} />}
                      {role === 'admin' && <Shield className={cn('h-4 w-4', meta.color)} />}
                      {role === 'moderator' && <Zap className={cn('h-4 w-4', meta.color)} />}
                      {role === 'member' && <Users className={cn('h-4 w-4', meta.color)} />}
                      {role === 'viewer' && <Eye className={cn('h-4 w-4', meta.color)} />}
                    </div>
                    <div>
                      <p className={cn('text-sm font-semibold', meta.color)}>{meta.label}</p>
                      <p className="text-xs text-slate-500">{meta.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Click-away for role dropdowns */}
      {openRoleMenu && (
        <div className="fixed inset-0 z-10" onClick={() => setOpenRoleMenu(null)} />
      )}
    </div>
  );
};
