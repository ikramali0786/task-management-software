import { motion } from 'framer-motion';
import { Calendar, MessageSquare, Paperclip, GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task } from '@/types';
import { PriorityBadge } from '@/components/ui/Badge';
import { AvatarGroup } from '@/components/ui/Avatar';
import { useUIStore } from '@/store/uiStore';
import { formatDate, isOverdue, cn } from '@/lib/utils';

interface TaskCardProps {
  task: Task;
  isDragging?: boolean;
}

export const TaskCard = ({ task, isDragging }: TaskCardProps) => {
  const { openTaskDetail } = useUIStore();
  const overdue = isOverdue(task.dueDate, task.status);

  return (
    <motion.div
      layout
      layoutId={task._id}
      onClick={() => openTaskDetail(task._id)}
      className={cn(
        'cursor-pointer rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800',
        isDragging && 'opacity-50 rotate-2 shadow-xl',
        overdue && 'border-red-200 dark:border-red-800/50'
      )}
    >
      {/* Labels */}
      {task.labels.length > 0 && (
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
        <PriorityBadge priority={task.priority} />
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

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        <AvatarGroup users={task.assignees} max={3} />
        <div className="flex items-center gap-2 text-slate-300 dark:text-slate-600">
          <MessageSquare className="h-3 w-3" />
          <Paperclip className="h-3 w-3" />
        </div>
      </div>
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
    <div ref={setNodeRef} style={style} className="group relative">
      <div
        {...attributes}
        {...listeners}
        className="absolute left-1 top-1/2 -translate-y-1/2 cursor-grab rounded p-0.5 text-slate-300 opacity-0 group-hover:opacity-100 dark:text-slate-600"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>
      <TaskCard task={task} isDragging={isDragging} />
    </div>
  );
};
