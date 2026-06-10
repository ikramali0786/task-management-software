import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, Users, MessageCircle, Settings } from 'lucide-react';
import { useTeamStore } from '@/store/teamStore';
import { useAuthStore } from '@/store/authStore';
import { Badge } from '@/components/ui/Badge';
import { TeamOverviewTab } from '@/components/team/TeamOverviewTab';
import { TeamMembersTab } from '@/components/team/TeamMembersTab';
import { TeamSettingsTab } from '@/components/team/TeamSettingsTab';
import { DiscussionSection } from '@/components/team/DiscussionSection';
import { cn } from '@/lib/utils';

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

export const TeamPage = () => {
  const { activeTeam } = useTeamStore();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

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

  return (
    <div className="mx-auto w-full max-w-3xl p-6 md:p-8 space-y-5">
      {/* Team Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl gradient-brand text-2xl font-bold text-white shadow-sm">
          {activeTeam.name[0]}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 truncate">{activeTeam.name}</h2>
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
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
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
          {activeTab === 'overview' && <TeamOverviewTab onInvite={() => setActiveTab('members')} />}
          {activeTab === 'members' && <TeamMembersTab />}
          {activeTab === 'discussions' && (
            <div className="card">
              <DiscussionSection teamId={activeTeam._id} members={members} isAdmin={isAdmin} />
            </div>
          )}
          {activeTab === 'settings' && <TeamSettingsTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
