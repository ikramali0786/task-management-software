import { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, GripVertical, ListChecks, CheckSquare, Square } from 'lucide-react';
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
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export const TaskCard = ({ task, isDragging, selectionMode, isSelected, onToggleSelect }: TaskCardProps) => {
  const { openTaskDetail } = useUIStore();
  const { activeTeam } = useTeamStore();
  const [hasReactions, setHasReactions] = useState(false);
  const overdue = isOverdue(task.dueDate, task.status);
  const priority = task.priority ?? 'medium';
  const teamId = typeof task.team === 'string' ? task.team : (task.team as any)?._id || activeTeam?._id || '';

  const handleClick = () => {
    if (isDragging) return;
    if (selectionMode && onToggleSelect) {
      onToggleSelect(task._id);
    } else {
      openTaskDetail(task._id);
    }
  };

  return (
    <motion.div
      layout
      onClick={handleClick}
      className={cn(
        'group cursor-pointer rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm transition-all hover:shadow-md dark:border-slate-700 dark:bg-slate-800',
        isDragging && 'shadow-2xl ring-2 ring-brand-400/40 rotate-1 opacity-95',
        overdue && 'border-red-200 dark:border-red-800/50',
        isSelected && 'ring-2 ring-brand-500 border-brand-300 dark:border-brand-600'
      )}
    >
      {/* Selection checkbox */}
      {selectionMode && (
        <div className="mb-2 flex items-center gap-2">
          {isSelected ? (
            <CheckSquare className="h-4 w-4 text-brand-500" />
          ) : (
            <Square className="h-4 w-4 text-slate-300 dark:text-slate-600" />
          )}
        </div>
      )}

      {/* Labels — text pills */}
      {task.labels?.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {task.labels.slice(0, 3).map((label, i) => (
            <span
              key={i}
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold leading-tight text-white"
              style={{ backgroundColor: label.color }}
            >
              {label.name}
            </span>
          ))}
          {task.labels.length > 3 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-400">
              +{task.labels.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Identifier + Title */}
      <div className="flex items-start gap-1.5">
        {task.identifier != null && (
          <span className="mt-px flex-shrink-0 rounded bg-slate-100 px-1 py-0.5 font-mono text-[9px] font-semibold text-slate-400 dark:bg-slate-700 dark:text-slate-500">
            #{task.identifier}
          </span>
        )}
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 line-clamp-2 leading-relaxed">
          {task.title}
        </p>
      </div>

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

      {/* Subtask progress */}
      {task.subtasks?.length > 0 && (() => {
        const total = task.subtasks.length;
        const done = task.subtasks.filter((s) => s.completed).length;
        const pct = Math.round((done / total) * 100);
        const labelCls = pct === 100 ? 'text-emerald-600 dark:text-emerald-400' : pct > 0 ? 'text-amber-500 dark:text-amber-400' : 'text-slate-400';
        const barCls = pct === 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-400' : 'bg-slate-300 dark:bg-slate-600';
        return (
          <div className="mt-2.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className={cn('flex items-center gap-1 text-[10px] font-medium', labelCls)}>
                <ListChecks className="h-2.5 w-2.5" />{done}/{total}
              </span>
              <span className={cn('text-[10px] font-medium', labelCls)}>{pct}%</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
              <div className={cn('h-full rounded-full transition-all duration-300', barCls)} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })()}

      {/* Footer — assignees only (no fake icons) */}
      <div className="mt-3 flex items-center">
        <AvatarGroup users={task.assignees ?? []} max={3} />
      </div>

      {/* Emoji reactions — only in normal mode */}
      {!selectionMode && teamId && (
        <div
          className={cn(
            'mt-2.5 pt-2 transition-colors',
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

interface SortableProps {
  task: Task;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export const SortableTaskCard = ({ task, selectionMode, isSelected, onToggleSelect }: SortableProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task._id,
    data: { type: 'task', task },
    disabled: selectionMode, // disable DnD in selection mode
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 999 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn('group relative', isDragging && 'opacity-30')}>
      {!selectionMode && (
        <div
          {...attributes}
          {...listeners}
          className="absolute right-2 top-2 z-10 cursor-grab rounded-md p-1 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-slate-100 dark:text-slate-600 dark:hover:bg-slate-700"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </div>
      )}
      <TaskCard
        task={task}
        isDragging={isDragging}
        selectionMode={selectionMode}
        isSelected={isSelected}
        onToggleSelect={onToggleSelect}
      />
    </div>
  );
};
