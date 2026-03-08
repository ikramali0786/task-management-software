import { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Search, X, Hash, Terminal, LayoutDashboard, Kanban, User,
  CalendarDays, Users, BarChart2, Activity, Settings, Plus,
  Moon, Sun, PanelLeftClose, Bot,
} from 'lucide-react';
import { useTaskStore } from '@/store/taskStore';
import { useUIStore } from '@/store/uiStore';
import { TASK_STATUSES } from '@/types';
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

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearch = ({ isOpen, onClose }: Props) => {
  const { tasks } = useTaskStore();
  const { openTaskDetail, setQuickCreateOpen, toggleSidebarCollapsed, setTheme, theme } = useUIStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const isCommandMode = query.startsWith('>');
  const commandQuery = isCommandMode ? query.slice(1).trim().toLowerCase() : '';
  const taskQuery = !isCommandMode ? query.toLowerCase() : '';

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

  const taskResults = useMemo(() => {
    if (!taskQuery.trim()) return [];
    const q = taskQuery.trim();
    return Object.values(tasks)
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
      .slice(0, 8);
  }, [taskQuery, tasks]);

  const items = isCommandMode ? filteredCommands : taskResults;

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
  }, [items.length]);

  // Scroll active item into view
  useEffect(() => {
    const item = listRef.current?.children[activeIdx] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  const selectTask = (taskId: string) => {
    openTaskDetail(taskId);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (isCommandMode) {
        if (filteredCommands[activeIdx]) filteredCommands[activeIdx].action();
      } else {
        if (taskResults[activeIdx]) selectTask(taskResults[activeIdx]._id);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

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
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
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
                  placeholder={isCommandMode ? 'Type a command…' : 'Search tasks or type > for commands…'}
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
                      <li key={cmd.id}>
                        <button
                          onMouseEnter={() => setActiveIdx(i)}
                          onClick={() => cmd.action()}
                          className={cn(
                            'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                            i === activeIdx
                              ? 'bg-brand-50 dark:bg-brand-500/10'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                          )}
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
              ) : taskResults.length > 0 ? (
                <ul ref={listRef} className="max-h-80 overflow-y-auto py-1.5">
                  {taskResults.map((task, i) => {
                    const status = statusConfig[task.status];
                    return (
                      <li key={task._id}>
                        <button
                          onMouseEnter={() => setActiveIdx(i)}
                          onClick={() => selectTask(task._id)}
                          className={cn(
                            'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                            i === activeIdx
                              ? 'bg-brand-50 dark:bg-brand-500/10'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                          )}
                        >
                          {/* Status dot */}
                          <span
                            className="h-2 w-2 flex-shrink-0 rounded-full"
                            style={{ backgroundColor: status?.color }}
                          />

                          {/* Title */}
                          <span className="flex-1 truncate text-sm text-slate-800 dark:text-slate-100">
                            {task.title}
                          </span>

                          {/* Identifier */}
                          {task.identifier != null && (
                            <span className="flex flex-shrink-0 items-center gap-0.5 font-mono text-xs text-slate-400">
                              <Hash className="h-2.5 w-2.5" />
                              {task.identifier}
                            </span>
                          )}

                          {/* Status label */}
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
                </ul>
              ) : query.trim() && !isCommandMode ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-slate-400">No tasks found for "{query}"</p>
                </div>
              ) : !query.trim() ? (
                <div className="py-8 text-center">
                  <Search className="mx-auto mb-2 h-6 w-6 text-slate-200 dark:text-slate-700" />
                  <p className="text-sm text-slate-400">Type to search tasks</p>
                  <p className="mt-1 text-xs text-slate-300 dark:text-slate-600">
                    or type{' '}
                    <kbd className="rounded border border-slate-200 bg-slate-50 px-1 font-mono dark:border-slate-700 dark:bg-slate-800">
                      &gt;
                    </kbd>
                    {' '}for commands
                  </p>
                </div>
              ) : null}

              {/* Footer hint */}
              {items.length > 0 && (
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
