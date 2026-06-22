import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Copy, Check, UserPlus, Crown, Shield, Trash2, Lock, Unlock, Hash,
  Info, X, Eye, Zap, Users, Mail, Send, UserCog,
} from 'lucide-react';
import { useTeamStore } from '@/store/teamStore';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { teamService } from '@/services/teamService';
import { joinTeamRooms } from '@/lib/socket';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { cn, formatLastSeen } from '@/lib/utils';
import { UserRole } from '@/types';

const ROLE_META: Record<string, { label: string; description: string; color: string }> = {
  owner:     { label: 'Owner',     description: 'Full control — edit team, delete, transfer ownership.', color: 'text-amber-500' },
  admin:     { label: 'Admin',     description: 'Manage members, lock/unlock, generate invite codes.',   color: 'text-brand-500' },
  moderator: { label: 'Moderator', description: 'Create, edit, and delete any task.',                    color: 'text-blue-500' },
  member:    { label: 'Member',    description: 'Create tasks and edit tasks they created.',              color: 'text-slate-600' },
  viewer:    { label: 'Viewer',    description: 'View-only access — cannot create or edit tasks.',        color: 'text-slate-400' },
};
const ASSIGNABLE_ROLES: UserRole[] = ['admin', 'moderator', 'member', 'viewer'];

const roleBadgeVariant = (role: string): 'warning' | 'info' | 'default' | 'danger' => {
  if (role === 'owner' || role === 'admin') return 'warning';
  if (role === 'moderator') return 'info';
  if (role === 'viewer') return 'danger';
  return 'default';
};

export const TeamMembersTab = () => {
  const { activeTeam, fetchTeams, updateTeam } = useTeamStore();
  const { user } = useAuthStore();
  const { addToast, showConfirm } = useUIStore();

  const [inviteCode, setInviteCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [togglingLock, setTogglingLock] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [openRoleMenu, setOpenRoleMenu] = useState<string | null>(null);

  if (!activeTeam) return null;
  const isOwner = activeTeam.owner._id === user?._id;
  const currentMember = activeTeam.members.find((m) => m.user._id === user?._id);
  const isAdmin = isOwner || currentMember?.role === 'admin';
  const isLocked = activeTeam.settings?.isLocked ?? false;

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

  const handleInviteByEmail = async () => {
    const email = inviteEmail.trim();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      addToast({ type: 'error', title: 'Enter a valid email address' });
      return;
    }
    setSendingInvite(true);
    try {
      await teamService.inviteByEmail(activeTeam._id, email);
      addToast({ type: 'success', title: 'Invite sent', message: `An invite is on its way to ${email}.` });
      setInviteEmail('');
    } catch (err: any) {
      addToast({ type: 'error', title: err.response?.data?.message || 'Failed to send invite' });
    } finally {
      setSendingInvite(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setJoining(true);
    try {
      const team = await teamService.joinByCode(joinCode.trim());
      if (team?._id) joinTeamRooms([team._id]);
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
      addToast({ type: 'success', title: newLock ? 'Team locked' : 'Team unlocked' });
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

  const handleToggleGuest = async (userId: string, isGuest: boolean) => {
    try {
      await teamService.setGuest(activeTeam._id, userId, isGuest);
      await fetchTeams();
      addToast({ type: 'success', title: isGuest ? 'Marked as guest' : 'Converted to member' });
    } catch {
      addToast({ type: 'error', title: 'Failed to update guest status' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Invite section (admins) */}
      {isAdmin && (
        <div className="card space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/10">
              <UserPlus className="h-5 w-5 text-brand-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Invite members</h3>
              <p className="text-xs text-slate-400">Bring teammates in by email or a one-time code.</p>
            </div>
          </div>
          {isLocked && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 dark:border-amber-800/40 dark:bg-amber-500/10">
              <Lock className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Team is locked — invite codes can be generated but new members can't join until unlocked.
              </p>
            </div>
          )}
          <div className="space-y-3">
            {/* Invite by email */}
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                <Mail className="h-3.5 w-3.5" /> Invite by email
              </label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    type="email"
                    placeholder="teammate@example.com"
                    leftIcon={<Mail className="h-4 w-4" />}
                    value={inviteEmail}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInviteEmail(e.target.value)}
                    onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handleInviteByEmail()}
                  />
                </div>
                <Button onClick={handleInviteByEmail} isLoading={sendingInvite} className="flex-shrink-0 gap-2">
                  <Send className="h-4 w-4" /> Send
                </Button>
              </div>
              <p className="mt-1.5 text-xs text-slate-400">We'll email them a link to join. Valid for 7 days.</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
              <span className="text-xs text-slate-400">or share a code</span>
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            </div>

            <Button onClick={handleGenerateCode} isLoading={generatingCode} variant="secondary" className="gap-2">
              <UserPlus className="h-4 w-4" /> Generate Invite Code
            </Button>
            <p className="text-xs text-slate-400">Codes expire after 5 minutes — share them quickly.</p>
            {inviteCode && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 dark:border-brand-800 dark:bg-brand-500/10"
              >
                <code className="flex-1 font-mono text-sm text-brand-700 dark:text-brand-300 break-all">{inviteCode}</code>
                <button onClick={handleCopy} className="flex-shrink-0 rounded-lg p-1.5 text-brand-500 hover:bg-brand-100 dark:hover:bg-brand-500/20">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </motion.div>
            )}
          </div>
        </div>
      )}

      {/* Join another team */}
      <div className="card space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
            <Hash className="h-5 w-5 text-slate-500 dark:text-slate-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Join another team</h3>
            <p className="text-xs text-slate-400">Have an invite code? Paste it below.</p>
          </div>
        </div>
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
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Members <span className="text-slate-400">({activeTeam.members.length})</span>
          </h3>
          <button
            onClick={() => setRolesOpen(true)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <Info className="h-3.5 w-3.5" /> Role guide
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
                className="group flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition-colors hover:border-slate-200 hover:bg-slate-50/60 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800/40"
              >
                <div className="relative flex-shrink-0">
                  <Avatar name={m.user.name} src={m.user.avatar} size="md" />
                  <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900 ${isActive ? 'bg-emerald-400' : 'bg-slate-300 dark:bg-slate-600'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {m.user.name}
                      {isSelf && <span className="ml-1 font-normal text-xs text-slate-400">(you)</span>}
                    </p>
                    {memberIsOwner && <Crown className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />}
                  </div>
                  <p className="truncate text-xs text-slate-400">{m.user.email}</p>
                  <p className={`mt-0.5 text-xs font-medium ${isActive ? 'text-emerald-500' : 'text-slate-400'}`}>{activeLabel}</p>
                </div>

                {m.isGuest && (
                  <span className="flex-shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:bg-sky-500/15 dark:text-sky-400" title="Read-only · not a paid seat">Guest</span>
                )}
                <Badge variant={roleBadgeVariant(displayRole)} className="flex-shrink-0">{ROLE_META[displayRole]?.label || displayRole}</Badge>

                {isAdmin && !isSelf && !memberIsOwner && (
                  <div className="flex flex-shrink-0 items-center gap-0.5 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                    <button
                      onClick={() => handleToggleGuest(m.user._id, !m.isGuest)}
                      className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                      title={m.isGuest ? 'Convert to full member' : 'Make guest (read-only, free seat)'}
                    >
                      <UserCog className="h-3.5 w-3.5" />
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => setOpenRoleMenu(openRoleMenu === m.user._id ? null : m.user._id)}
                        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
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
                            className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lift dark:border-slate-700 dark:bg-slate-800"
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
                      className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
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
            <div className="flex min-w-0 items-center gap-2.5">
              <div
                className={cn(
                  'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl',
                  isLocked ? 'bg-red-50 dark:bg-red-500/10' : 'bg-emerald-50 dark:bg-emerald-500/10'
                )}
              >
                {isLocked ? <Lock className="h-4 w-4 text-red-500" /> : <Unlock className="h-4 w-4 text-emerald-500" />}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Team lock</h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {isLocked ? 'Locked — new members cannot join.' : 'Unlocked — anyone with a valid invite code can join.'}
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              onClick={handleToggleLock}
              isLoading={togglingLock}
              className={cn('flex-shrink-0 gap-2', isLocked && 'border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400')}
            >
              {isLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              {isLocked ? 'Unlock' : 'Lock team'}
            </Button>
          </div>
        </div>
      )}

      {/* Roles Info Modal */}
      <AnimatePresence>
        {rolesOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
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
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Role permissions</h3>
                <button onClick={() => setRolesOpen(false)} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2">
                {Object.entries(ROLE_META).map(([role, meta]) => (
                  <div key={role} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-800/70">
                      {role === 'owner' && <Crown className={cn('h-4 w-4', meta.color)} />}
                      {role === 'admin' && <Shield className={cn('h-4 w-4', meta.color)} />}
                      {role === 'moderator' && <Zap className={cn('h-4 w-4', meta.color)} />}
                      {role === 'member' && <Users className={cn('h-4 w-4', meta.color)} />}
                      {role === 'viewer' && <Eye className={cn('h-4 w-4', meta.color)} />}
                    </div>
                    <div className="min-w-0">
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
      {openRoleMenu && <div className="fixed inset-0 z-10" onClick={() => setOpenRoleMenu(null)} />}
    </div>
  );
};
