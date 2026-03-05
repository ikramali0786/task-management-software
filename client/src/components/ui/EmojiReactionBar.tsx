import { useState, useEffect, useRef } from 'react';
import { Smile } from 'lucide-react';
import { reactionService, ReactionGroup } from '@/services/reactionService';
import { useAuthStore } from '@/store/authStore';
import { getSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';

const COMMON_EMOJIS = [
  '👍', '👎', '❤️', '🎉', '😂', '😮',
  '😢', '😡', '🔥', '✅', '⭐', '🚀',
  '👀', '💡', '🙏', '💯', '😎', '🤔',
  '👏', '🥳', '😍', '🤩', '💪', '🎯',
  '✨', '💬', '📌', '⚡', '🌟', '🤝',
];

interface Props {
  resourceId: string;
  resourceType: 'task' | 'comment' | 'discussion';
  teamId: string;
  size?: 'sm' | 'md';
  /** compact mode: hides the "React" button until the parent `group` is hovered */
  compact?: boolean;
  /** called whenever the reactions count changes — useful for conditional parent styling */
  onReactionsChange?: (hasReactions: boolean) => void;
}

export const EmojiReactionBar = ({ resourceId, resourceType, teamId, size = 'sm', compact = false, onReactionsChange }: Props) => {
  const [reactions, setReactions] = useState<ReactionGroup[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();

  useEffect(() => {
    reactionService.getReactions(resourceId).then(setReactions).catch(() => {});
  }, [resourceId]);

  // Notify parent when reaction count changes (e.g. for conditional border on kanban cards)
  useEffect(() => {
    onReactionsChange?.(reactions.length > 0);
  }, [reactions.length, onReactionsChange]);

  // Socket: real-time reaction updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = (data: { resourceId: string; reactions: ReactionGroup[] }) => {
      if (data.resourceId === resourceId) {
        setReactions(data.reactions);
      }
    };
    socket.on('reaction:toggled', handler);
    return () => { socket.off('reaction:toggled', handler); };
  }, [resourceId]);

  // Close picker on outside click
  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPicker]);

  const toggle = async (emoji: string) => {
    if (!user) return;
    setShowPicker(false);

    // Optimistic update
    setReactions((prev) => {
      const existing = prev.find((r) => r.emoji === emoji);
      if (existing) {
        const alreadyReacted = existing.users.includes(user._id);
        const newCount = alreadyReacted ? existing.count - 1 : existing.count + 1;
        const newUsers = alreadyReacted
          ? existing.users.filter((u) => u !== user._id)
          : [...existing.users, user._id];
        if (newCount === 0) return prev.filter((r) => r.emoji !== emoji);
        return prev.map((r) =>
          r.emoji === emoji ? { ...r, count: newCount, users: newUsers, reacted: !alreadyReacted } : r
        );
      }
      return [...prev, { emoji, count: 1, users: [user._id], reacted: true }];
    });

    try {
      await reactionService.toggleReaction({ resourceId, resourceType, emoji, teamId });
    } catch {
      // revert on error — refetch
      reactionService.getReactions(resourceId).then(setReactions).catch(() => {});
    }
  };

  return (
    <div className="relative flex flex-wrap items-center gap-1">
      {/* Existing reaction pills */}
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => toggle(r.emoji)}
          title={`${r.count} reaction${r.count !== 1 ? 's' : ''}`}
          className={cn(
            'flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-all hover:scale-105 active:scale-95',
            size === 'sm' ? 'text-xs' : 'text-sm',
            r.reacted
              ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-600 dark:bg-brand-500/10 dark:text-brand-300'
              : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
          )}
        >
          <span>{r.emoji}</span>
          <span className="font-medium">{r.count}</span>
        </button>
      ))}

      {/* Add reaction button — hidden until card hover in compact mode */}
      <div ref={pickerRef} className={cn('relative', compact && 'opacity-0 group-hover:opacity-100 transition-opacity duration-150')}>
        <button
          type="button"
          onClick={() => setShowPicker((v) => !v)}
          className={cn(
            'flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-slate-400 transition-all hover:border-slate-400 hover:text-slate-600 dark:hover:border-slate-500 dark:hover:text-slate-300',
            size === 'sm' ? 'text-xs' : 'text-sm',
            'border-slate-300 dark:border-slate-700'
          )}
          title="Add reaction"
        >
          <Smile className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
          <span className="hidden sm:inline text-xs">React</span>
        </button>

        {showPicker && (
          <div className="absolute bottom-full left-0 z-50 mb-1 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800">
            <p className="mb-1.5 px-1 text-xs font-medium text-slate-400">Quick Reactions</p>
            <div className="grid grid-cols-6 gap-0.5">
              {COMMON_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => toggle(emoji)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-base transition-all hover:bg-slate-100 hover:scale-110 active:scale-95 dark:hover:bg-slate-700"
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
