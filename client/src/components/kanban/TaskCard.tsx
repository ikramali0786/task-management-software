import { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, MessageSquare, Paperclip, GripVertical, ListChecks } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task } from '@/types';
import { PriorityBadge } from '@/components/ui/Badge';
import { AvatarGroup } from '@/components/ui/Avatar';
import { EmojiReactionBar } from '@/components/ui/EmojiReactionBar';
import { useUIStore } from '@/store/uiStore';
import { useTeamStore } from '@/store/teamStore';
import { formatDate, isOverdue, cn } from '@/lib/utils';

interface TaskCardProps {
  task: Task;
  isDragging?: boolean;
}

export const TaskCard = ({ task, isDragging }: TaskCardProps) => {
  const { openTaskDetail } = useUIStore();
  const { activeTeam } = useTeamStore();
  const [hasReactions, setHasReactions] = useState(false);
  const overdue = isOverdue(task.dueDate, task.status);
  // Guard: priority badge crashes if priority is undefined
  const priority = task.priority ?? 'medium';
  // task.team may be a string ID (not populated in list endpoint)
  const teamId = typeof task.team === 'string' ? task.team : (task.team as any)?._id || activeTeam?._id || '';

  return (
    <motion.div
      layout
      // layoutId removed — having the same layoutId in both the column and
      // the DragOverlay simultaneously causes a Framer Motion charCodeAt crash
      onClick={() => !isDragging && openTaskDetail(task._id)}
      className={cn(
        'group cursor-pointer rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm transition-all hover:shadow-md dark:border-slate-700 dark:bg-slate-800',
        isDragging && 'shadow-2xl ring-2 ring-brand-400/40 rotate-1 opacity-95',
        overdue && 'border-red-200 dark:border-red-800/50'
      )}
    >
      {/* Labels */}
      {task.labels?.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {task.labels.slice(0, 3).map((label, i) => (
            <span
              key={i}
              className="h-1.5 w-8 rounded-full"
              style={{ backgroundColor: label.color }}
            />
          ))}
        </div>
      )}

      {/* Title */}
      <p className="text-sm font-medium text-slate-800 dark:text-slate-100 line-clamp-2 leading-relaxed">
        {task.title}
      </p>

      {/* Priority + Due date */}
      <div className="mt-2.5 flex items-center gap-2 flex-wrap">
        <PriorityBadge priority={priority} />
        {task.dueDate && (
          <span className={cn(
            'flex items-center gap-1 text-xs',
            overdue ? 'text-red-500' : 'text-slate-400'
          )}>
            <Calendar className="h-3 w-3" />
            {formatDate(task.dueDate)}
          </span>
        )}
      </div>

      {/* Subtask progress — only shown when task has subtasks */}
      {task.subtasks?.length > 0 && (() => {
        const total = task.subtasks.length;
        const done = task.subtasks.filter((s) => s.completed).length;
        const pct = Math.round((done / total) * 100);
        return (
          <div className="mt-2.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-[10px] font-medium text-slate-400">
                <ListChecks className="h-2.5 w-2.5" />
                {done}/{total}
              </span>
              <span className="text-[10px] font-medium text-slate-400">{pct}%</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  pct === 100 ? 'bg-emerald-500' : 'bg-brand-400'
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })()}

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        <AvatarGroup users={task.assignees ?? []} max={3} />
        <div className="flex items-center gap-2 text-slate-300 dark:text-slate-600">
          <MessageSquare className="h-3 w-3" />
          <Paperclip className="h-3 w-3" />
        </div>
      </div>

      {/* Emoji reactions — stopPropagation prevents opening the detail modal */}
      {teamId && (
        <div
          className={cn(
            'mt-2.5 pt-2 transition-colors',
            // Always show border when reactions exist; on hover show it even when empty
            hasReactions
              ? 'border-t border-slate-100 dark:border-slate-700'
              : 'border-t border-transparent group-hover:border-slate-100 dark:group-hover:border-slate-700'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <EmojiReactionBar
            resourceId={task._id}
            resourceType="task"
            teamId={teamId}
            size="sm"
            compact
            onReactionsChange={setHasReactions}
          />
        </div>
      )}
    </motion.div>
  );
};

export const SortableTaskCard = ({ task }: { task: Task }) => {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: task._id, data: { type: 'task', task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 999 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn('group relative', isDragging && 'opacity-30')}>
      {/* Grip handle — top-right corner, appears on hover */}
      <div
        {...attributes}
        {...listeners}
        className="absolute right-2 top-2 z-10 cursor-grab rounded-md p-1 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-slate-100 dark:text-slate-600 dark:hover:bg-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>
      <TaskCard task={task} isDragging={isDragging} />
    </div>
  );
};
