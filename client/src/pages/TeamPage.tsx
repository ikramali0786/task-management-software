import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Copy, Check, UserPlus, Crown, Shield, Trash2, Lock, Unlock, Hash,
  ChevronDown, Info, Edit2, Save, X, Eye, Zap, Users,
} from 'lucide-react';
import { useTeamStore } from '@/store/teamStore';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { teamService } from '@/services/teamService';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { UserRole } from '@/types';

// ── Role meta ────────────────────────────────────────────────────────────────
const ROLE_META: Record<UserRole | 'member', { label: string; description: string; color: string }> = {
  owner:     { label: 'Owner',     description: 'Full control — edit team, delete, transfer ownership.', color: 'text-amber-500' },
  admin:     { label: 'Admin',     description: 'Manage members, lock/unlock, generate invite codes.',   color: 'text-purple-500' },
  moderator: { label: 'Moderator', description: 'Create, edit, and delete any task.',                     color: 'text-blue-500' },
  member:    { label: 'Member',    description: 'Create tasks and edit tasks they created.',              color: 'text-slate-600' },
  viewer:    { label: 'Viewer',    description: 'View-only access — cannot create or edit tasks.',        color: 'text-slate-400' },
};

const ASSIGNABLE_ROLES: UserRole[] = ['admin', 'moderator', 'member', 'viewer'];

const roleBadgeVariant = (role: UserRole | string): 'warning' | 'info' | 'default' | 'danger' => {
  if (role === 'owner' || role === 'admin') return 'warning';
  if (role === 'moderator') return 'info';
  if (role === 'viewer') return 'danger';
  return 'default';
};

export const TeamPage = () => {
  const { activeTeam, fetchTeams, updateTeam } = useTeamStore();
  const { user } = useAuthStore();
  const { addToast } = useUIStore();

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

  // Team edit (owner only)
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Role dropdowns per member
  const [openRoleMenu, setOpenRoleMenu] = useState<string | null>(null);

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

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleGenerateCode = async () => {
    setGeneratingCode(true);
    try {
      const { inviteCode: code } = await teamService.generateInviteCode(activeTeam._id);
      setInviteCode(code);
      addToast({ type: 'success', title: 'Invite code generated', message: 'Valid for 5 minutes — share it quickly!' });
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
      // Surface lock message clearly
      if (msg.toLowerCase().includes('locked')) {
        addToast({ type: 'error', title: 'Team is locked', message: 'This team is not accepting new members right now.' });
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
        message: newLock
          ? 'New members cannot join, even with an invite code.'
          : 'Anyone with a valid invite code can join.',
      });
    } catch {
      addToast({ type: 'error', title: 'Failed to update lock' });
    } finally {
      setTogglingLock(false);
    }
  };

  const handleRemoveMember = async (userId: string, name: string) => {
    if (!confirm(`Remove ${name} from the team?`)) return;
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

  const handleStartEdit = () => {
    setEditName(activeTeam.name);
    setEditDesc(activeTeam.description || '');
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) return;
    setSavingEdit(true);
    try {
      await teamService.updateTeam(activeTeam._id, { name: editName.trim(), description: editDesc.trim() });
      await fetchTeams();
      addToast({ type: 'success', title: 'Team updated' });
      setEditing(false);
    } catch {
      addToast({ type: 'error', title: 'Failed to update team' });
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">

      {/* ── Team info card ──────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card">
        {editing ? (
          <div className="space-y-3">
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Team name"
              className="w-full rounded-xl border border-brand-400 bg-transparent px-4 py-2 text-lg font-bold text-slate-900 focus:outline-none dark:text-white"
            />
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
            <div className="flex gap-2">
              <Button onClick={handleSaveEdit} isLoading={savingEdit} size="sm" className="gap-1.5">
                <Save className="h-3.5 w-3.5" /> Save
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setEditing(false)} className="gap-1.5">
                <X className="h-3.5 w-3.5" /> Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl gradient-brand text-xl font-bold text-white">
              {activeTeam.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{activeTeam.name}</h2>
                {isOwner && (
                  <button
                    onClick={handleStartEdit}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 transition-colors"
                    title="Edit team name"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="mt-0.5 text-sm text-slate-500">{activeTeam.description || 'No description'}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="info">{activeTeam.members.length} members</Badge>
                {isOwner && <Badge variant="warning">Owner</Badge>}
                {!isOwner && isAdmin && <Badge variant="warning">Admin</Badge>}
                {isLocked && <Badge variant="danger">Locked</Badge>}
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* ── Team Lock (admins only) ─────────────────────────────────────── */}
      {isAdmin && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {isLocked ? <Lock className="h-4 w-4 text-red-500" /> : <Unlock className="h-4 w-4 text-emerald-500" />}
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Team Lock</h3>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {isLocked
                  ? 'Locked — new members cannot join, even with an invite code.'
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
        </motion.div>
      )}

      {/* ── Invite Members (admins only) ───────────────────────────────── */}
      {isAdmin && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card">
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Invite Members</h3>
          {isLocked && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 dark:border-amber-800/40 dark:bg-amber-500/10">
              <Lock className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Team is locked — invite codes can be generated but new members cannot join until you unlock the team.
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
                initial={{ opacity: 0, y: -10 }}
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
        </motion.div>
      )}

      {/* ── Join Another Team (everyone) ───────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="card">
        <h3 className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">Join Another Team</h3>
        <p className="mb-3 text-xs text-slate-500">Have an invite code? Paste it below to join any team.</p>
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
          <Button onClick={handleJoin} isLoading={joining} className="flex-shrink-0">
            Join
          </Button>
        </div>
      </motion.div>

      {/* ── Members list ───────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Members ({activeTeam.members.length})
          </h3>
          {/* Roles info button */}
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
            const displayRole: UserRole = memberIsOwner ? 'owner' : (m.role as UserRole);

            return (
              <div
                key={m.user._id}
                className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800"
              >
                <Avatar name={m.user.name} src={m.user.avatar} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {m.user.name}
                      {isSelf && <span className="ml-1 text-xs text-slate-400">(you)</span>}
                    </p>
                    {memberIsOwner && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                  </div>
                  <p className="text-xs text-slate-400">{m.user.email}</p>
                </div>

                <Badge variant={roleBadgeVariant(displayRole)}>
                  {ROLE_META[displayRole]?.label || displayRole}
                </Badge>

                {isAdmin && !isSelf && !memberIsOwner && (
                  <div className="flex items-center gap-1">
                    {/* Role selector dropdown */}
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

                    {/* Remove member */}
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
      </motion.div>

      {/* ── Roles Info Modal ────────────────────────────────────────────── */}
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
                {(Object.entries(ROLE_META) as [UserRole, typeof ROLE_META[UserRole]][]).map(([role, meta]) => (
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
