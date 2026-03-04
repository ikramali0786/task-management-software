import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Kanban, RefreshCw } from 'lucide-react';
import { useTeamStore } from '@/store/teamStore';
import { useTaskStore } from '@/store/taskStore';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { Button } from '@/components/ui/Button';

export const KanbanPage = () => {
  const { activeTeam } = useTeamStore();
  const { fetchTasks, isLoading } = useTaskStore();

  useEffect(() => {
    if (activeTeam) fetchTasks(activeTeam._id);
  }, [activeTeam?._id]);

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

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Board header */}
      <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-3 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          {activeTeam.name}
        </h2>
        <span className="text-slate-300 dark:text-slate-600">·</span>
        <span className="text-sm text-slate-400">Kanban Board</span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fetchTasks(activeTeam._id)}
            title="Refresh board"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <KanbanBoard />
      </div>
    </div>
  );
};
