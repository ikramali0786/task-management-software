import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, UserPlus, Crown, Shield, Trash2, Lock, Unlock, Hash } from 'lucide-react';
import { useTeamStore } from '@/store/teamStore';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { teamService } from '@/services/teamService';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

export const TeamPage = () => {
  const { activeTeam, fetchTeams, updateTeam } = useTeamStore();
  const { user } = useAuthStore();
  const { addToast } = useUIStore();

  const [inviteCode, setInviteCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [togglingLock, setTogglingLock] = useState(false);

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

  const handleGenerateCode = async () => {
    setGeneratingCode(true);
    try {
      const { inviteCode: code } = await teamService.generateInviteCode(activeTeam._id);
      setInviteCode(code);
      addToast({ type: 'success', title: 'Invite code generated', message: 'Valid for 7 days.' });
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
      addToast({ type: 'error', title: err.response?.data?.message || 'Invalid or expired code' });
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
          ? 'Only admins can create or edit tasks.'
          : 'All members can create and edit tasks.',
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

  const handleRoleChange = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'member' : 'admin';
    try {
      await teamService.updateMemberRole(activeTeam._id, userId, newRole);
      await fetchTeams();
      addToast({ type: 'success', title: `Role updated to ${newRole}` });
    } catch {
      addToast({ type: 'error', title: 'Failed to update role' });
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      {/* Team info */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl gradient-brand text-xl font-bold text-white">
            {activeTeam.name[0]}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{activeTeam.name}</h2>
            <p className="mt-0.5 text-sm text-slate-500">{activeTeam.description || 'No description'}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="info">{activeTeam.members.length} members</Badge>
              {isOwner && <Badge variant="warning">Owner</Badge>}
              {!isOwner && isAdmin && <Badge variant="warning">Admin</Badge>}
              {isLocked && <Badge variant="danger">Locked</Badge>}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Team Lock (admins only) */}
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
                  ? 'Locked — only admins can create or edit tasks.'
                  : 'Unlocked — all members can create and edit tasks.'}
              </p>
            </div>
            <Button
              variant={isLocked ? 'secondary' : 'secondary'}
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

      {/* Invite Members (admins only) */}
      {isAdmin && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card">
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Invite Members</h3>
          <div className="space-y-3">
            <Button onClick={handleGenerateCode} isLoading={generatingCode} variant="secondary" className="gap-2">
              <UserPlus className="h-4 w-4" />
              Generate Invite Code
            </Button>
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

      {/* Join Another Team (everyone) */}
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

      {/* Members list */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card">
        <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
          Members ({activeTeam.members.length})
        </h3>
        <div className="space-y-2">
          {activeTeam.members.map((m) => {
            const memberIsOwner = activeTeam.owner._id === m.user._id;
            const isSelf = m.user._id === user?._id;
            const displayRole = memberIsOwner ? 'owner' : m.role;
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
                <Badge variant={memberIsOwner ? 'warning' : m.role === 'admin' ? 'warning' : 'default'}>
                  {displayRole}
                </Badge>
                {isAdmin && !isSelf && !memberIsOwner && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleRoleChange(m.user._id, m.role)}
                      className={cn(
                        'rounded-lg p-1.5 transition-colors',
                        m.role === 'admin'
                          ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10'
                          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800'
                      )}
                      title={m.role === 'admin' ? 'Demote to member' : 'Promote to admin'}
                    >
                      <Shield className="h-3.5 w-3.5" />
                    </button>
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
    </div>
  );
};
