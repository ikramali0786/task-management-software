import { useEffect, useState, useMemo } from 'react';
import { Kanban } from 'lucide-react';
import { useTeamStore } from '@/store/teamStore';
import { useTaskStore } from '@/store/taskStore';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { ListView } from '@/components/kanban/ListView';
import { TaskFilterBar, TaskFilters, DEFAULT_FILTERS } from '@/components/kanban/TaskFilterBar';
import { Task } from '@/types';

const isOverdueDate = (d: string | null) => {
  if (!d) return false;
  return new Date(d) < new Date(new Date().setHours(0, 0, 0, 0));
};
const isTodayDate = (d: string | null) => {
  if (!d) return false;
  const due = new Date(d);
  const today = new Date();
  return (
    due.getDate() === today.getDate() &&
    due.getMonth() === today.getMonth() &&
    due.getFullYear() === today.getFullYear()
  );
};
const isThisWeekDate = (d: string | null) => {
  if (!d) return false;
  const due = new Date(d);
  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setDate(now.getDate() + 7);
  return due >= now && due <= weekEnd;
};

const applyFilters = (tasks: Task[], filters: TaskFilters): Task[] => {
  const search = filters.search.trim().toLowerCase();
  return tasks.filter((t) => {
    if (search && !t.title.toLowerCase().includes(search) && !t.description?.toLowerCase().includes(search)) return false;
    if (filters.priorities.length > 0 && !filters.priorities.includes(t.priority)) return false;
    if (filters.assigneeIds.length > 0 && !t.assignees.some((a) => filters.assigneeIds.includes(a._id))) return false;
    if (filters.dueDateFilter === 'overdue' && !isOverdueDate(t.dueDate)) return false;
    if (filters.dueDateFilter === 'today' && !isTodayDate(t.dueDate)) return false;
    if (filters.dueDateFilter === 'week' && !isThisWeekDate(t.dueDate)) return false;
    if (filters.dueDateFilter === 'no-date' && t.dueDate !== null) return false;
    return true;
  });
};

export const KanbanPage = () => {
  const { activeTeam } = useTeamStore();
  const { tasks, fetchTasks, isLoading } = useTaskStore();
  const [filters, setFilters] = useState<TaskFilters>(DEFAULT_FILTERS);
  const [view, setView] = useState<'board' | 'list'>('board');
  // Selection mode lifted here so the toolbar can render Select/Cancel
  const [selectionMode, setSelectionMode] = useState(false);

  useEffect(() => {
    if (activeTeam) fetchTasks(activeTeam._id);
  }, [activeTeam?._id]);

  // Reset filters + selection when team changes
  useEffect(() => {
    setFilters(DEFAULT_FILTERS);
    setSelectionMode(false);
    setView('board');
  }, [activeTeam?._id]);

  const allTasks = useMemo(() => Object.values(tasks), [tasks]);
  const filteredTaskIds = useMemo(() => {
    const filtered = applyFilters(allTasks, filters);
    return new Set(filtered.map((t) => t._id));
  }, [allTasks, filters]);

  const isFiltered =
    filters.search.trim() !== '' ||
    filters.priorities.length > 0 ||
    filters.assigneeIds.length > 0 ||
    filters.dueDateFilter !== 'all';

  if (!activeTeam) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Kanban className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
          <p className="mt-3 text-sm text-slate-500">Select or create a team to get started</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Loading tasks...</p>
        </div>
      </div>
    );
  }

  const members = activeTeam.members.map((m) => m.user);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Single unified toolbar — replaces the old board header + filter bar */}
      <TaskFilterBar
        filters={filters}
        onChange={setFilters}
        members={members}
        totalCount={allTasks.length}
        filteredCount={isFiltered ? filteredTaskIds.size : allTasks.length}
        teamName={activeTeam.name}
        teamId={activeTeam._id}
        onRefresh={() => fetchTasks(activeTeam._id)}
        selectionMode={selectionMode}
        onToggleSelection={() => setSelectionMode((v) => !v)}
        view={view}
        onViewChange={setView}
      />

      {/* Board or List view */}
      {view === 'board' ? (
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <KanbanBoard
            filteredTaskIds={isFiltered ? filteredTaskIds : null}
            selectionMode={selectionMode}
            onExitSelection={() => setSelectionMode(false)}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <ListView
            filteredTaskIds={isFiltered ? filteredTaskIds : null}
            tasks={tasks}
          />
        </div>
      )}
    </div>
  );
};
