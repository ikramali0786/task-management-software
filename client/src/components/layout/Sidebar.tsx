import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Kanban, Users, Settings, LogOut, Zap,
  Plus, ChevronDown, ChevronRight, BarChart2, Bot, Activity, CalendarDays,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useTeamStore } from '@/store/teamStore';
import { useUIStore } from '@/store/uiStore';
import { Avatar } from '@/components/ui/Avatar';
import { CreateTeamModal } from '@/components/team/CreateTeamModal';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true, shortcut: 'D' },
  { to: '/board', icon: Kanban, label: 'Kanban Board', shortcut: 'B' },
  { to: '/calendar', icon: CalendarDays, label: 'Calendar', shortcut: 'L' },
  { to: '/chatbots', icon: Bot, label: 'AI Chatbots', shortcut: 'C' },
  { to: '/team', icon: Users, label: 'Team', shortcut: 'T' },
  { to: '/workload', icon: BarChart2, label: 'Workload', shortcut: 'W' },
  { to: '/activity', icon: Activity, label: 'Activity', shortcut: 'A' },
  { to: '/settings', icon: Settings, label: 'Settings', shortcut: 'S' },
];

export const Sidebar = () => {
  const { user, logout } = useAuthStore();
  const { teams, activeTeam, setActiveTeam } = useTeamStore();
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [showTeamMenu, setShowTeamMenu] = useState(false);
  const [showCreateTeam, setShowCreateTeam] = useState(false);

  // Auto-close sidebar on small screens when navigating
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  // Close sidebar when screen resizes below lg breakpoint
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < 1024 && sidebarOpen) {
        // Only force-close on resize if it drops below lg
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isSmall = typeof window !== 'undefined' && window.innerWidth < 1024;

  return (
    <>
      {/* Mobile overlay backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            key="sidebar-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar panel */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            key="sidebar-panel"
            initial={{ x: isSmall ? -240 : 0, opacity: isSmall ? 0 : 1 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -240, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 36 }}
            className="fixed left-0 top-0 z-40 flex h-full w-60 flex-col border-r border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900 lg:relative lg:z-auto"
          >
            {/* Logo */}
            <div className="flex items-center gap-2.5 px-5 py-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl gradient-brand">
                <Zap className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold gradient-text">TaskFlow</span>
            </div>

            {/* Team Switcher */}
            <div className="px-3">
              <button
                onClick={() => setShowTeamMenu(!showTeamMenu)}
                className="flex w-full items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-left transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/50 dark:hover:bg-slate-800"
              >
                {activeTeam ? (
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-brand-500 text-xs font-bold text-white">
                    {activeTeam.name[0].toUpperCase()}
                  </div>
                ) : (
                  <div className="h-7 w-7 flex-shrink-0 rounded-lg bg-slate-200 dark:bg-slate-700" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {activeTeam?.name || 'Select Team'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {activeTeam ? `${activeTeam.members.length} members` : 'No team selected'}
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    'h-3.5 w-3.5 text-slate-400 transition-transform',
                    showTeamMenu && 'rotate-180'
                  )}
                />
              </button>

              <AnimatePresence>
                {showTeamMenu && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-1 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800"
                  >
                    {teams.map((team) => (
                      <button
                        key={team._id}
                        onClick={() => { setActiveTeam(team); setShowTeamMenu(false); }}
                        className={cn(
                          'flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-700',
                          activeTeam?._id === team._id &&
                            'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400'
                        )}
                      >
                        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-brand-500 text-xs font-bold text-white">
                          {team.name[0]}
                        </div>
                        <span className="truncate font-medium">{team.name}</span>
                        {activeTeam?._id === team._id && (
                          <ChevronRight className="ml-auto h-3 w-3" />
                        )}
                      </button>
                    ))}
                    <button
                      onClick={() => { setShowTeamMenu(false); setShowCreateTeam(true); }}
                      className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-sm font-medium text-brand-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700"
                    >
                      <Plus className="h-4 w-4" />
                      New Team
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Nav */}
            <nav className="mt-4 flex-1 space-y-0.5 px-3">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => cn('sidebar-link group', isActive && 'active')}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.shortcut && (
                    <kbd className="ml-auto hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-400 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 lg:inline-flex dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500">
                      {item.shortcut}
                    </kbd>
                  )}
                </NavLink>
              ))}
            </nav>

            {/* User footer */}
            <div className="border-t border-slate-100 p-3 dark:border-slate-800">
              <div className="flex items-center gap-3 rounded-xl px-2 py-2">
                <Avatar name={user?.name || 'User'} src={user?.avatar} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                    {user?.name}
                  </p>
                  <p className="truncate text-xs text-slate-400">{user?.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <CreateTeamModal isOpen={showCreateTeam} onClose={() => setShowCreateTeam(false)} />
    </>
  );
};
