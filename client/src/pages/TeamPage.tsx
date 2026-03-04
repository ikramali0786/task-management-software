import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, UserPlus, Crown, Shield, User, Trash2, LogOut } from 'lucide-react';
import { useTeamStore } from '@/store/teamStore';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { teamService } from '@/services/teamService';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

export const TeamPage = () => {
  const { activeTeam, fetchTeams } = useTeamStore();
  const { user } = useAuthStore();
  const { addToast } = useUIStore();

  const [inviteCode, setInviteCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  if (!activeTeam) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-slate-400">No team selected</p>
      </div>
    );
  }

  const currentMember = activeTeam.members.find((m) => m.user._id === user?._id);
  const isAdmin = currentMember?.role === 'admin';

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
      await teamService.joinTeam(activeTeam._id, joinCode.trim());
      await fetchTeams();
      addToast({ type: 'success', title: 'Joined team!' });
      setShowJoin(false);
      setJoinCode('');
    } catch (err: any) {
      addToast({ type: 'error', title: err.response?.data?.message || 'Invalid or expired code' });
    } finally {
      setJoining(false);
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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl gradient-brand text-xl font-bold text-white">
            {activeTeam.name[0]}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{activeTeam.name}</h2>
            <p className="mt-0.5 text-sm text-slate-500">{activeTeam.description || 'No description'}</p>
            <div className="mt-2 flex gap-2">
              <Badge variant="info">{activeTeam.members.length} members</Badge>
              {isAdmin && <Badge variant="warning">Admin</Badge>}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Invite */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card"
      >
        <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Invite Members</h3>
        {isAdmin ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button onClick={handleGenerateCode} isLoading={generatingCode} variant="secondary" className="flex-shrink-0">
                <UserPlus className="h-4 w-4" />
                Generate Invite Code
              </Button>
            </div>
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
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Have an invite code? Join a team below.</p>
            <div className="flex gap-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Enter invite code..."
                className="input-field flex-1"
              />
              <Button onClick={handleJoin} isLoading={joining} className="flex-shrink-0">
                Join
              </Button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Members list */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card"
      >
        <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
          Members ({activeTeam.members.length})
        </h3>
        <div className="space-y-2">
          {activeTeam.members.map((m) => {
            const isOwner = activeTeam.owner._id === m.user._id;
            const isSelf = m.user._id === user?._id;
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
                    {isOwner && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                  </div>
                  <p className="text-xs text-slate-400">{m.user.email}</p>
                </div>
                <Badge variant={m.role === 'admin' ? 'warning' : 'default'}>
                  {m.role}
                </Badge>
                {isAdmin && !isSelf && !isOwner && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleRoleChange(m.user._id, m.role)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 transition-colors"
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
