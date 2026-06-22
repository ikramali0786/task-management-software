import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, Users, MessageCircle, Settings, Crown, Shield, Lock, CalendarDays } from 'lucide-react';
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
  const memberCount = activeTeam.members.length;
  const createdLabel = new Date(activeTeam.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-6 md:p-8">
      {/* Team header */}
      <div className="card overflow-hidden p-0">
        <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-5 sm:p-6">
          {/* Ambient ember wash behind the header */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-50/70 via-transparent to-transparent dark:from-brand-500/[0.07]"
          />
          <div className="relative flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl gradient-brand text-3xl font-bold text-white shadow-ember">
            {activeTeam.name[0]?.toUpperCase()}
          </div>
          <div className="relative min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="truncate text-2xl font-bold text-slate-900 dark:text-slate-100">{activeTeam.name}</h1>
              <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5">
                {isOwner && (
                  <Badge variant="warning">
                    <Crown className="h-3 w-3" /> Owner
                  </Badge>
                )}
                {!isOwner && isAdmin && (
                  <Badge variant="warning">
                    <Shield className="h-3 w-3" /> Admin
                  </Badge>
                )}
                {isLocked && (
                  <Badge variant="danger">
                    <Lock className="h-3 w-3" /> Locked
                  </Badge>
                )}
              </div>
            </div>
            <p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">
              {activeTeam.description || 'No description yet'}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 dark:text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {memberCount} member{memberCount !== 1 ? 's' : ''}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                Created {createdLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="relative border-t border-slate-200/80 px-2 dark:border-slate-800">
          <div className="flex gap-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  'relative flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap px-3 py-3 text-sm font-medium transition-colors',
                  activeTab === id
                    ? 'text-brand-600 dark:text-brand-400'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:block">{label}</span>
                {activeTab === id && (
                  <motion.span
                    layoutId="team-tab-underline"
                    className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand-500"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
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
