import { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Search, X, Hash, Terminal, LayoutDashboard, Kanban, User,
  CalendarDays, Users, BarChart2, Activity, Settings, Plus,
  Moon, Sun, PanelLeftClose, Bot,
} from 'lucide-react';
import { useTaskStore } from '@/store/taskStore';
import { useTeamStore } from '@/store/teamStore';
import { useUIStore } from '@/store/uiStore';
import { TASK_STATUSES, Task, Team, User as TUser } from '@/types';
import { cn } from '@/lib/utils';

const statusConfig = Object.fromEntries(TASK_STATUSES.map((s) => [s.id, s]));

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  action: () => void;
  keywords?: string;
}

// A single result row in default (search) mode. Tasks, teams and people are
// merged into one keyboard-navigable list, grouped under section headers.
type SearchResult =
  | { kind: 'task'; task: Task }
  | { kind: 'team'; team: Team }
  | { kind: 'member'; user: TUser; team: Team };

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearch = ({ isOpen, onClose }: Props) => {
  const { tasks } = useTaskStore();
  const { teams, setActiveTeam } = useTeamStore();
  const { openTaskDetail, setQuickCreateOpen, toggleSidebarCollapsed, setTheme, theme } = useUIStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const isCommandMode = query.startsWith('>');
  const commandQuery = isCommandMode ? query.slice(1).trim().toLowerCase() : '';
  const searchQuery = !isCommandMode ? query.trim().toLowerCase() : '';

  // Build commands list
  const commands = useMemo((): Command[] => [
    // Navigation
    { id: 'go-dashboard', label: 'Go to Dashboard', description: 'Dashboard', icon: LayoutDashboard, keywords: 'navigate home', action: () => { navigate('/'); onClose(); } },
    { id: 'go-mytasks', label: 'Go to My Tasks', description: 'My Tasks', icon: User, keywords: 'navigate my tasks', action: () => { navigate('/my-tasks'); onClose(); } },
    { id: 'go-board', label: 'Go to Board', description: 'Kanban Board', icon: Kanban, keywords: 'navigate board kanban', action: () => { navigate('/board'); onClose(); } },
    { id: 'go-calendar', label: 'Go to Calendar', description: 'Calendar', icon: CalendarDays, keywords: 'navigate calendar', action: () => { navigate('/calendar'); onClose(); } },
    { id: 'go-team', label: 'Go to Team', description: 'Team', icon: Users, keywords: 'navigate team', action: () => { navigate('/team'); onClose(); } },
    { id: 'go-workload', label: 'Go to Workload', description: 'Workload', icon: BarChart2, keywords: 'navigate workload', action: () => { navigate('/workload'); onClose(); } },
    { id: 'go-activity', label: 'Go to Activity', description: 'Activity', icon: Activity, keywords: 'navigate activity', action: () => { navigate('/activity'); onClose(); } },
    { id: 'go-chatbots', label: 'Go to AI Chatbots', description: 'AI Chatbots', icon: Bot, keywords: 'navigate chatbot ai', action: () => { navigate('/chatbots'); onClose(); } },
    { id: 'go-settings', label: 'Go to Settings', description: 'Settings', icon: Settings, keywords: 'navigate settings', action: () => { navigate('/settings'); onClose(); } },
    // Actions
    { id: 'new-task', label: 'New task', description: 'Create a new task', icon: Plus, keywords: 'create add task new', action: () => { setQuickCreateOpen(true); onClose(); } },
    { id: 'toggle-theme', label: `Toggle ${theme === 'dark' ? 'light' : 'dark'} mode`, description: 'Switch color scheme', icon: theme === 'dark' ? Sun : Moon, keywords: 'dark light mode theme', action: () => { setTheme(theme === 'dark' ? 'light' : 'dark'); onClose(); } },
    { id: 'toggle-sidebar', label: 'Toggle sidebar', description: 'Collapse or expand sidebar', icon: PanelLeftClose, keywords: 'sidebar collapse expand', action: () => { toggleSidebarCollapsed(); onClose(); } },
  ], [navigate, onClose, theme]);

  const filteredCommands = useMemo(() => {
    if (!commandQuery) return commands;
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(commandQuery) ||
        (c.description?.toLowerCase().includes(commandQuery)) ||
        (c.keywords?.toLowerCase().includes(commandQuery))
    );
  }, [commands, commandQuery]);

  // ── Merged task + team + people search ────────────────────────────────────
  const { taskHits, teamHits, memberHits, flat } = useMemo(() => {
    if (isCommandMode || !searchQuery) {
      return { taskHits: [] as Task[], teamHits: [] as Team[], memberHits: [] as { user: TUser; team: Team }[], flat: [] as SearchResult[] };
    }
    const q = searchQuery;

    const taskList = Object.values(tasks)
      .filter(
        (t) =>
          !t.isArchived &&
          (t.title.toLowerCase().includes(q) ||
            (t.description && t.description.toLowerCase().includes(q)))
      )
      .sort((a, b) => {
        const aExact = a.title.toLowerCase().startsWith(q);
        const bExact = b.title.toLowerCase().startsWith(q);
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        return 0;
      })
      .slice(0, 6);

    const teamList = teams.filter((t) => t.name.toLowerCase().includes(q)).slice(0, 4);

    // Dedupe people across all teams; first team they appear in wins for context.
    const seen = new Set<string>();
    const memberList: { user: TUser; team: Team }[] = [];
    for (const team of teams) {
      for (const m of team.members) {
        const u = m.user;
        if (!u || seen.has(u._id)) continue;
        const hay = `${u.name} ${u.username || ''} ${u.email || ''}`.toLowerCase();
        if (hay.includes(q)) {
          seen.add(u._id);
          memberList.push({ user: u, team });
        }
      }
    }
    const trimmedMembers = memberList.slice(0, 5);

    const flatList: SearchResult[] = [
      ...taskList.map((t): SearchResult => ({ kind: 'task', task: t })),
      ...teamList.map((t): SearchResult => ({ kind: 'team', team: t })),
      ...trimmedMembers.map((m): SearchResult => ({ kind: 'member', user: m.user, team: m.team })),
    ];

    return { taskHits: taskList, teamHits: teamList, memberHits: trimmedMembers, flat: flatList };
  }, [searchQuery, tasks, teams, isCommandMode]);

  const itemCount = isCommandMode ? filteredCommands.length : flat.length;

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIdx(0);
      const raf = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(raf);
    }
  }, [isOpen]);

  // Reset selection index when results change
  useEffect(() => {
    setActiveIdx(0);
  }, [itemCount]);

  // Scroll active item into view
  useEffect(() => {
    const item = listRef.current?.querySelectorAll('[data-result]')[activeIdx] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  const runResult = (r: SearchResult) => {
    if (r.kind === 'task') {
      openTaskDetail(r.task._id);
    } else if (r.kind === 'team') {
      setActiveTeam(r.team);
      navigate('/board');
    } else {
      setActiveTeam(r.team);
      navigate('/team');
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, itemCount - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (isCommandMode) {
        filteredCommands[activeIdx]?.action();
      } else {
        if (flat[activeIdx]) runResult(flat[activeIdx]);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  // Section offsets so each rendered row can compute its flat index.
  const teamOffset = taskHits.length;
  const memberOffset = taskHits.length + teamHits.length;

  const SectionHeader = ({ label }: { label: string }) => (
    <li className="px-4 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
      {label}
    </li>
  );

  const rowClass = (active: boolean) =>
    cn(
      'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
      active ? 'bg-brand-50 dark:bg-brand-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
    );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          />

          {/* Modal */}
          <div className="fixed inset-x-0 top-20 z-50 mx-auto max-w-xl px-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 pointer-events-auto"
            >
              {/* Input row */}
              <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5 dark:border-slate-800">
                {isCommandMode ? (
                  <Terminal className="h-4 w-4 flex-shrink-0 text-brand-500" />
                ) : (
                  <Search className="h-4 w-4 flex-shrink-0 text-slate-400" />
                )}
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isCommandMode ? 'Type a command…' : 'Search tasks, teams, people — or type > for commands…'}
                  className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
                />
                {query ? (
                  <button
                    onClick={() => setQuery('')}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 dark:border-slate-700 dark:bg-slate-800">
                    ESC
                  </kbd>
                )}
              </div>

              {/* Command mode results */}
              {isCommandMode ? (
                filteredCommands.length > 0 ? (
                  <ul ref={listRef} className="max-h-80 overflow-y-auto py-1.5">
                    {filteredCommands.map((cmd, i) => (
                      <li key={cmd.id} data-result>
                        <button
                          onMouseEnter={() => setActiveIdx(i)}
                          onClick={() => cmd.action()}
                          className={rowClass(i === activeIdx)}
                        >
                          <div className={cn(
                            'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg',
                            i === activeIdx ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                          )}>
                            <cmd.icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{cmd.label}</p>
                            {cmd.description && (
                              <p className="text-xs text-slate-400">{cmd.description}</p>
                            )}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="py-10 text-center">
                    <p className="text-sm text-slate-400">No commands found</p>
                  </div>
                )
              ) : flat.length > 0 ? (
                <ul ref={listRef} className="max-h-80 overflow-y-auto py-1.5">
                  {/* Tasks */}
                  {taskHits.length > 0 && <SectionHeader label="Tasks" />}
                  {taskHits.map((task, i) => {
                    const status = statusConfig[task.status];
                    return (
                      <li key={`task-${task._id}`} data-result>
                        <button
                          onMouseEnter={() => setActiveIdx(i)}
                          onClick={() => runResult({ kind: 'task', task })}
                          className={rowClass(i === activeIdx)}
                        >
                          <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: status?.color }} />
                          <span className="flex-1 truncate text-sm text-slate-800 dark:text-slate-100">{task.title}</span>
                          {task.identifier != null && (
                            <span className="flex flex-shrink-0 items-center gap-0.5 font-mono text-xs text-slate-400">
                              <Hash className="h-2.5 w-2.5" />
                              {task.identifier}
                            </span>
                          )}
                          <span
                            className="hidden flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium text-white sm:inline"
                            style={{ backgroundColor: status?.color }}
                          >
                            {status?.label}
                          </span>
                        </button>
                      </li>
                    );
                  })}

                  {/* Teams */}
                  {teamHits.length > 0 && <SectionHeader label="Teams" />}
                  {teamHits.map((team, i) => {
                    const idx = teamOffset + i;
                    return (
                      <li key={`team-${team._id}`} data-result>
                        <button
                          onMouseEnter={() => setActiveIdx(idx)}
                          onClick={() => runResult({ kind: 'team', team })}
                          className={rowClass(idx === activeIdx)}
                        >
                          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            <Users className="h-3.5 w-3.5" />
                          </div>
                          <span className="flex-1 truncate text-sm text-slate-800 dark:text-slate-100">{team.name}</span>
                          <span className="flex-shrink-0 text-xs text-slate-400">
                            {team.members.length} member{team.members.length === 1 ? '' : 's'}
                          </span>
                        </button>
                      </li>
                    );
                  })}

                  {/* People */}
                  {memberHits.length > 0 && <SectionHeader label="People" />}
                  {memberHits.map(({ user, team }, i) => {
                    const idx = memberOffset + i;
                    return (
                      <li key={`member-${user._id}`} data-result>
                        <button
                          onMouseEnter={() => setActiveIdx(idx)}
                          onClick={() => runResult({ kind: 'member', user, team })}
                          className={rowClass(idx === activeIdx)}
                        >
                          {user.avatar ? (
                            <img src={user.avatar} alt={user.name} className="h-7 w-7 flex-shrink-0 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-xs font-semibold text-brand-600 dark:text-brand-300">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-slate-800 dark:text-slate-100">{user.name}</p>
                            <p className="truncate text-xs text-slate-400">
                              {user.username ? `@${user.username}` : user.email} · {team.name}
                            </p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : searchQuery ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-slate-400">No matches for "{query}"</p>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <Search className="mx-auto mb-2 h-6 w-6 text-slate-200 dark:text-slate-700" />
                  <p className="text-sm text-slate-400">Search tasks, teams &amp; people</p>
                  <p className="mt-1 text-xs text-slate-300 dark:text-slate-600">
                    or type{' '}
                    <kbd className="rounded border border-slate-200 bg-slate-50 px-1 font-mono dark:border-slate-700 dark:bg-slate-800">
                      &gt;
                    </kbd>
                    {' '}for commands
                  </p>
                </div>
              )}

              {/* Footer hint */}
              {itemCount > 0 && (
                <div className="flex items-center gap-3 border-t border-slate-100 px-4 py-2 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400">
                    <kbd className="rounded border border-slate-200 bg-slate-50 px-1 font-mono dark:border-slate-700 dark:bg-slate-800">↑↓</kbd>
                    {' '}navigate
                  </span>
                  <span className="text-[10px] text-slate-400">
                    <kbd className="rounded border border-slate-200 bg-slate-50 px-1 font-mono dark:border-slate-700 dark:bg-slate-800">↵</kbd>
                    {' '}select
                  </span>
                  <span className="text-[10px] text-slate-400">
                    <kbd className="rounded border border-slate-200 bg-slate-50 px-1 font-mono dark:border-slate-700 dark:bg-slate-800">esc</kbd>
                    {' '}close
                  </span>
                  <div className="flex-1" />
                  {!isCommandMode && (
                    <button
                      onClick={() => setQuery('>')}
                      className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-brand-500 transition-colors"
                    >
                      <Terminal className="h-3 w-3" />
                      Commands
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
