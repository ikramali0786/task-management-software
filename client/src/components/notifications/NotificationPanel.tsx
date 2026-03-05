import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bell, CheckCheck, Zap, UserPlus, CheckCircle2, AlertCircle, AtSign } from 'lucide-react';
import { Slideover } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { useNotificationStore } from '@/store/notificationStore';
import { Notification, NotificationType } from '@/types';
import { formatRelative, cn } from '@/lib/utils';

const notifIcons: Record<NotificationType, React.ReactNode> = {
  task_assigned: <Zap className="h-3.5 w-3.5 text-brand-500" />,
  task_updated: <Zap className="h-3.5 w-3.5 text-blue-500" />,
  task_completed: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
  task_due_soon: <AlertCircle className="h-3.5 w-3.5 text-amber-500" />,
  task_overdue: <AlertCircle className="h-3.5 w-3.5 text-red-500" />,
  team_invite: <UserPlus className="h-3.5 w-3.5 text-purple-500" />,
  member_joined: <UserPlus className="h-3.5 w-3.5 text-cyan-500" />,
  mention: <AtSign className="h-3.5 w-3.5 text-violet-500" />,
};

const NotifItem = ({ notification, onRead }: { notification: Notification; onRead: (id: string) => void }) => (
  <motion.div
    layout
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    onClick={() => !notification.isRead && onRead(notification._id)}
    className={cn(
      'flex cursor-pointer gap-3 px-5 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50',
      !notification.isRead && 'bg-brand-50/50 dark:bg-brand-500/5'
    )}
  >
    <div className="relative flex-shrink-0">
      <Avatar name={notification.actor.name} src={notification.actor.avatar} size="sm" />
      <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white ring-1 ring-slate-100 dark:bg-slate-800 dark:ring-slate-700">
        {notifIcons[notification.type]}
      </div>
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-sm text-slate-700 dark:text-slate-300">{notification.message}</p>
      {notification.task && (
        <p className="mt-0.5 truncate text-xs text-slate-400">
          Task: {notification.task.title}
        </p>
      )}
      <p className="mt-1 text-xs text-slate-400">{formatRelative(notification.createdAt)}</p>
    </div>
    {!notification.isRead && (
      <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-brand-500" />
    )}
  </motion.div>
);

export const NotificationPanel = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { notifications, fetchNotifications, markRead, markAllRead, isLoading } = useNotificationStore();

  useEffect(() => {
    if (isOpen) fetchNotifications();
  }, [isOpen]);

  const unread = notifications.filter((n) => !n.isRead);
  const read = notifications.filter((n) => n.isRead);

  return (
    <Slideover isOpen={isOpen} onClose={onClose} title="Notifications" width="max-w-sm">
      <div className="flex h-full flex-col">
        {unread.length > 0 && (
          <div className="flex items-center justify-between px-5 pt-2 pb-1">
            <span className="text-xs font-medium text-slate-500">
              {unread.length} unread
            </span>
            <Button variant="ghost" size="sm" onClick={markAllRead} className="h-7 text-xs">
              <CheckCheck className="h-3 w-3" />
              Mark all read
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <div className="rounded-2xl bg-slate-100 p-4 dark:bg-slate-800">
              <Bell className="h-8 w-8 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">All caught up!</p>
            <p className="text-xs text-slate-400">No notifications yet.</p>
          </div>
        ) : (
          <div className="flex-1 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
            {unread.length > 0 && (
              <div>
                <div className="px-5 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">New</p>
                </div>
                {unread.map((n) => <NotifItem key={n._id} notification={n} onRead={markRead} />)}
              </div>
            )}
            {read.length > 0 && (
              <div>
                <div className="px-5 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Earlier</p>
                </div>
                {read.map((n) => <NotifItem key={n._id} notification={n} onRead={markRead} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </Slideover>
  );
};
