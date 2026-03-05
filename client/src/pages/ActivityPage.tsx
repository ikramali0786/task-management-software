import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, SquareKanban, UserPlus, Bell, CheckCircle2,
  AlertCircle, Edit3, Trash2, ArrowRight, Filter,
} from 'lucide-react';
import { useNotificationStore } from '@/store/notificationStore';
import { Avatar } from '@/components/ui/Avatar';
import { cn, formatRelative } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterType = 'all' | 'task' | 'notification';

interface TimelineItem {
  id: string;
  message: string;
  createdAt: string;
  kind: 'task' | 'notification';
  icon: string;
  actorName?: string;
  actorAvatar?: string;
  notifType?: string;
}

// ── Icon + colour helpers ─────────────────────────────────────────────────────

const getIcon = (item: TimelineItem) => {
  if (item.kind === 'notification') {
    if (item.notifType === 'member_joined') return UserPlus;
    if (item.notifType === 'task_assigned' || item.notifType === 'task_completed') return CheckCircle2;
    if (item.notifType === 'mention') return AlertCircle;
    return Bell;
  }
  // task activity — guess from message
  if (item.message.toLowerCase().includes('deleted')) return Trash2;
  if (item.message.toLowerCase().includes('renamed') || item.message.toLowerCase().includes('updated')) return Edit3;
  if (item.message.toLowerCase().includes('moved')) return ArrowRight;
  return SquareKanban;
};

const getIconColors = (item: TimelineItem) => {
  if (item.kind === 'notification') {
    if (item.notifType === 'member_joined')
      return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400';
    if (item.notifType === 'task_assigned' || item.notifType === 'task_completed')
      return 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400';
    if (item.notifType === 'mention')
      return 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400';
    return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
  }
  if (item.message.toLowerCase().includes('deleted'))
    return 'bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400';
  if (item.message.toLowerCase().includes('moved'))
    return 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400';
  if (item.message.toLowerCase().includes('created'))
    return 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400';
  return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
};

// ── Day grouping ──────────────────────────────────────────────────────────────

const groupByDay = (items: TimelineItem[]) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86_400_000;

  const groups: { label: string; items: TimelineItem[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Earlier', items: [] },
  ];

  for (const item of items) {
    const t = new Date(item.createdAt).getTime();
    if (t >= today) groups[0].items.push(item);
    else if (t >= yesterday) groups[1].items.push(item);
    else groups[2].items.push(item);
  }

  return groups.filter((g) => g.items.length > 0);
};

// ── Animation variants ────────────────────────────────────────────────────────

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};
const lineItem = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } },
};

// ── Component ─────────────────────────────────────────────────────────────────

export const ActivityPage = () => {
  const { notifications, taskActivities } = useNotificationStore();
  const [filter, setFilter] = useState<FilterType>('all');

  const allItems: TimelineItem[] = useMemo(() => {
    const notifItems: TimelineItem[] = notifications.map((n) => ({
      id: n._id,
      message: n.message,
      createdAt: n.createdAt,
      kind: 'notification' as const,
      icon: n.type,
      actorName: (n.actor as any)?.name,
      actorAvatar: (n.actor as any)?.avatar,
      notifType: n.type,
    }));

    const taskItems: TimelineItem[] = taskActivities.map((a) => ({
      id: a._id,
      message: a.message,
      createdAt: a.createdAt,
      kind: 'task' as const,
      icon: a.icon || 'task',
    }));

    return [...notifItems, ...taskItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [notifications, taskActivities]);

  const filtered = useMemo(
    () => (filter === 'all' ? allItems : allItems.filter((i) => i.kind === filter)),
    [allItems, filter]
  );

  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  return (
    <div className="mx-auto max-w-2xl p-6 md:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold text-slate-900 dark:text-white">
            <Activity className="h-6 w-6 text-brand-500" />
            Activity Timeline
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            All team activity and updates in one place.
          </p>
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1 rounded-xl border border-slate-100 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {(['all', 'task', 'notification'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-all',
                filter === f
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              )}
            >
              {f === 'all' && <Filter className="h-3 w-3" />}
              {f === 'task' && <SquareKanban className="h-3 w-3" />}
              {f === 'notification' && <Bell className="h-3 w-3" />}
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline body */}
      {filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-24 text-center"
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
            <Activity className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">
            No activity yet
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            Activity appears here as your team works on tasks and collaborates.
          </p>
        </motion.div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={filter}
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-8"
          >
            {groups.map((group) => (
              <div key={group.label}>
                {/* Day label */}
                <div className="mb-4 flex items-center gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {group.label}
                  </span>
                  <div className="flex-1 border-t border-slate-100 dark:border-slate-800" />
                  <span className="text-xs font-medium text-slate-300 dark:text-slate-600">
                    {group.items.length}
                  </span>
                </div>

                {/* Items with vertical spine */}
                <div className="relative pl-10">
                  {/* Vertical timeline line */}
                  <div className="absolute left-[19px] top-0 bottom-0 w-px bg-slate-100 dark:bg-slate-800" />

                  <div className="space-y-2">
                    {group.items.map((timeItem) => {
                      const IconComp = getIcon(timeItem);
                      const iconColors = getIconColors(timeItem);

                      return (
                        <motion.div
                          key={timeItem.id}
                          variants={lineItem}
                          className="relative flex gap-3"
                        >
                          {/* Icon node — positioned on the spine */}
                          <div className="absolute -left-10 z-10 flex-shrink-0">
                            {timeItem.actorName ? (
                              <div className="mt-2.5">
                                <Avatar
                                  name={timeItem.actorName}
                                  src={timeItem.actorAvatar}
                                  size="xs"
                                />
                              </div>
                            ) : (
                              <div
                                className={cn(
                                  'mt-2.5 flex h-7 w-7 items-center justify-center rounded-full',
                                  iconColors
                                )}
                              >
                                <IconComp className="h-3.5 w-3.5" />
                              </div>
                            )}
                          </div>

                          {/* Content card */}
                          <div className="min-w-0 flex-1 rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <p className="text-sm text-slate-700 dark:text-slate-200">
                              {timeItem.message}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-400">
                              {formatRelative(timeItem.createdAt)}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
};
