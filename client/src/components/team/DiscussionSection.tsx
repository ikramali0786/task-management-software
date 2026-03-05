import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Send, CornerDownRight, Pin, PinOff, Pencil, Trash2 } from 'lucide-react';
import { Discussion, User } from '@/types';
import { discussionService } from '@/services/discussionService';
import { useAuthStore } from '@/store/authStore';
import { Avatar } from '@/components/ui/Avatar';
import { MentionInput, extractMentions } from '@/components/ui/MentionInput';
import { EmojiReactionBar } from '@/components/ui/EmojiReactionBar';
import { cn, formatRelative } from '@/lib/utils';
import { getSocket } from '@/lib/socket';

interface Props {
  teamId: string;
  members: User[];
  isAdmin: boolean;
}

interface BubbleProps {
  disc: Discussion;
  isReply?: boolean;
  parentId?: string;
  currentUserId: string;
  isAdmin: boolean;
  teamId: string;
  members: User[];
  onReply?: () => void;
  onEdit: (id: string, body: string) => void;
  onDelete: (id: string, parentId?: string) => void;
  onPin: (id: string) => void;
}

const DiscussionBubble = ({
  disc,
  isReply = false,
  parentId,
  currentUserId,
  isAdmin,
  teamId,
  members,
  onReply,
  onEdit,
  onDelete,
  onPin,
}: BubbleProps) => {
  const [editBody, setEditBody] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const isMe = disc.author._id === currentUserId;

  if (disc.isDeleted) {
    return (
      <div className={cn('flex items-center gap-2', isReply && 'ml-10')}>
        <p className="text-xs italic text-slate-400">[message deleted]</p>
      </div>
    );
  }

  const startEdit = () => {
    setEditBody(disc.body);
    setIsEditing(true);
  };

  const saveEdit = () => {
    if (editBody.trim()) onEdit(disc._id, editBody.trim());
    setIsEditing(false);
  };

  return (
    <div className={cn('flex gap-2.5', isReply && 'ml-10')}>
      <Avatar name={disc.author.name} src={disc.author.avatar} size="sm" className="mt-0.5 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{disc.author.name}</span>
          <span className="text-xs text-slate-400">{formatRelative(disc.createdAt)}</span>
          {disc.editedAt && <span className="text-xs italic text-slate-400">(edited)</span>}
          {disc.isPinned && (
            <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
              <Pin className="h-3 w-3" />
              Pinned
            </span>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={2}
              autoFocus
              className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
            <div className="flex gap-3">
              <button onClick={saveEdit} className="text-xs font-medium text-brand-500 hover:text-brand-600">Save</button>
              <button onClick={() => setIsEditing(false)} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-300">{disc.body}</p>
        )}

        {/* Reactions */}
        {!isEditing && (
          <div className="mt-2">
            <EmojiReactionBar resourceId={disc._id} resourceType="discussion" teamId={teamId} size="sm" />
          </div>
        )}

        {!isEditing && (
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            {!isReply && onReply && (
              <button
                onClick={onReply}
                className="flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-brand-500"
              >
                <CornerDownRight className="h-3 w-3" />
                Reply
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => onPin(disc._id)}
                className={cn(
                  'flex items-center gap-1 text-xs transition-colors',
                  disc.isPinned
                    ? 'text-amber-500 hover:text-amber-700'
                    : 'text-slate-400 hover:text-amber-500'
                )}
              >
                {disc.isPinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                {disc.isPinned ? 'Unpin' : 'Pin'}
              </button>
            )}
            {isMe && (
              <>
                <button
                  onClick={startEdit}
                  className="flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-brand-500"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
                <button
                  onClick={() => onDelete(disc._id, parentId)}
                  className="flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-red-500"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const DiscussionSection = ({ teamId, members, isAdmin }: Props) => {
  const { user } = useAuthStore();
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBody, setNewBody] = useState('');
  const [newMentions, setNewMentions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [replyMentions, setReplyMentions] = useState<string[]>([]);

  useEffect(() => {
    setLoading(true);
    discussionService.getDiscussions(teamId)
      .then(setDiscussions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [teamId]);

  // Socket listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleCreated = ({ discussion }: { discussion: Discussion }) => {
      if (discussion.parentDiscussion) {
        // New reply — append to parent's replies
        setDiscussions((prev) =>
          prev.map((d) => {
            if (d._id === discussion.parentDiscussion) {
              // Skip if already present (optimistic duplicate)
              if ((d.replies || []).find((r) => r._id === discussion._id)) return d;
              return { ...d, replies: [...(d.replies || []), discussion] };
            }
            return d;
          })
        );
      } else {
        setDiscussions((prev) => {
          // Skip if already present (from optimistic insert or same event firing twice)
          // Also handle temp IDs: optimistic messages have _id starting with 'temp-'
          const alreadyExists = prev.find((d) => d._id === discussion._id);
          if (alreadyExists) return prev;

          // Replace optimistic temp entry if body matches (same author)
          const tempIdx = prev.findIndex(
            (d) => d._id.startsWith('temp-') && d.body === discussion.body
          );
          if (tempIdx !== -1) {
            const updated = [...prev];
            updated[tempIdx] = { ...discussion, replies: [] };
            return updated;
          }

          // Pinned messages go to the top, others go to the bottom (chronological)
          if (discussion.isPinned) {
            return [{ ...discussion, replies: [] }, ...prev];
          }
          return [...prev, { ...discussion, replies: [] }];
        });
      }
    };

    const handleUpdated = ({ discussion }: { discussion: Discussion }) => {
      setDiscussions((prev) =>
        prev.map((d) => {
          if (d._id === discussion._id) return { ...d, ...discussion };
          if (d.replies) {
            return { ...d, replies: d.replies.map((r) => r._id === discussion._id ? { ...r, ...discussion } : r) };
          }
          return d;
        })
      );
    };

    const handleDeleted = ({ discussionId, parentDiscussionId }: { discussionId: string; parentDiscussionId: string | null }) => {
      if (parentDiscussionId) {
        setDiscussions((prev) =>
          prev.map((d) =>
            d._id === parentDiscussionId
              ? { ...d, replies: (d.replies || []).map((r) => r._id === discussionId ? { ...r, isDeleted: true, body: '' } : r) }
              : d
          )
        );
      } else {
        setDiscussions((prev) =>
          prev.map((d) => (d._id === discussionId ? { ...d, isDeleted: true, body: '' } : d))
        );
      }
    };

    const handlePinned = ({ discussionId, isPinned }: { discussionId: string; isPinned: boolean }) => {
      setDiscussions((prev) => {
        const updated = prev.map((d) =>
          d._id === discussionId ? { ...d, isPinned } : d
        );
        // Sort: pinned first, then oldest→newest (matches API sort)
        return updated.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });
      });
    };

    socket.on('discussion:created', handleCreated);
    socket.on('discussion:updated', handleUpdated);
    socket.on('discussion:deleted', handleDeleted);
    socket.on('discussion:pinned', handlePinned);

    return () => {
      socket.off('discussion:created', handleCreated);
      socket.off('discussion:updated', handleUpdated);
      socket.off('discussion:deleted', handleDeleted);
      socket.off('discussion:pinned', handlePinned);
    };
  }, [teamId]);

  const handleSubmit = async () => {
    if (!newBody.trim() || !user) return;
    setSubmitting(true);

    // Optimistic insert — shows message instantly without waiting for socket
    const tempId = `temp-${Date.now()}`;
    const optimistic: Discussion = {
      _id: tempId,
      team: teamId,
      author: user as any,
      body: newBody.trim(),
      parentDiscussion: null,
      mentions: [],
      editedAt: null,
      isDeleted: false,
      isPinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      replies: [],
    };
    setDiscussions((prev) => [...prev, optimistic]);

    const bodyToSend = newBody.trim();
    const mentionsToSend = [...newMentions];
    setNewBody('');
    setNewMentions([]);

    try {
      const created = await discussionService.createDiscussion({
        teamId,
        body: bodyToSend,
        mentionedUserIds: mentionsToSend,
      });
      // Replace temp entry with real one (socket may also do this, duplicate check handles it)
      setDiscussions((prev) =>
        prev.map((d) => (d._id === tempId ? { ...created, replies: [] } : d))
      );
    } catch {
      // Revert optimistic insert
      setDiscussions((prev) => prev.filter((d) => d._id !== tempId));
      setNewBody(bodyToSend);
      setNewMentions(mentionsToSend);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (parentDiscussionId: string) => {
    if (!replyBody.trim() || !user) return;
    setSubmitting(true);

    // Optimistic reply insert
    const tempId = `temp-reply-${Date.now()}`;
    const optimisticReply: Discussion = {
      _id: tempId,
      team: teamId,
      author: user as any,
      body: replyBody.trim(),
      parentDiscussion: parentDiscussionId,
      mentions: [],
      editedAt: null,
      isDeleted: false,
      isPinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      replies: [],
    };
    setDiscussions((prev) =>
      prev.map((d) =>
        d._id === parentDiscussionId
          ? { ...d, replies: [...(d.replies || []), optimisticReply] }
          : d
      )
    );

    const bodyToSend = replyBody.trim();
    const mentionsToSend = [...replyMentions];
    setReplyBody('');
    setReplyMentions([]);
    setReplyingTo(null);

    try {
      const created = await discussionService.createDiscussion({
        teamId,
        body: bodyToSend,
        parentDiscussionId,
        mentionedUserIds: mentionsToSend,
      });
      // Replace temp reply with real one
      setDiscussions((prev) =>
        prev.map((d) =>
          d._id === parentDiscussionId
            ? { ...d, replies: (d.replies || []).map((r) => r._id === tempId ? created : r) }
            : d
        )
      );
    } catch {
      // Revert
      setDiscussions((prev) =>
        prev.map((d) =>
          d._id === parentDiscussionId
            ? { ...d, replies: (d.replies || []).filter((r) => r._id !== tempId) }
            : d
        )
      );
      setReplyBody(bodyToSend);
      setReplyMentions(mentionsToSend);
      setReplyingTo(parentDiscussionId);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (id: string, body: string) => {
    // Optimistic
    setDiscussions((prev) =>
      prev.map((d) => {
        if (d._id === id) return { ...d, body, editedAt: new Date().toISOString() };
        return { ...d, replies: (d.replies || []).map((r) => r._id === id ? { ...r, body, editedAt: new Date().toISOString() } : r) };
      })
    );
    try {
      await discussionService.updateDiscussion(id, body);
    } catch {
      discussionService.getDiscussions(teamId).then(setDiscussions).catch(() => {});
    }
  };

  const handleDelete = async (id: string, parentId?: string) => {
    if (!confirm('Delete this message?')) return;
    // Optimistic
    if (parentId) {
      setDiscussions((prev) =>
        prev.map((d) =>
          d._id === parentId
            ? { ...d, replies: (d.replies || []).map((r) => r._id === id ? { ...r, isDeleted: true, body: '' } : r) }
            : d
        )
      );
    } else {
      setDiscussions((prev) => prev.map((d) => (d._id === id ? { ...d, isDeleted: true, body: '' } : d)));
    }
    try {
      await discussionService.deleteDiscussion(id);
    } catch {
      discussionService.getDiscussions(teamId).then(setDiscussions).catch(() => {});
    }
  };

  const handlePin = async (id: string) => {
    try {
      const { isPinned } = await discussionService.togglePin(id);
      setDiscussions((prev) => {
        const updated = prev.map((d) => (d._id === id ? { ...d, isPinned } : d));
        return updated.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });
      });
    } catch {
      //
    }
  };

  return (
    <div className="space-y-5">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <MessageCircle className="h-3.5 w-3.5" />
        Team Discussions
      </h3>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </div>
      ) : discussions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center dark:border-slate-700">
          <MessageCircle className="mx-auto mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-400">No discussions yet.</p>
          <p className="text-xs text-slate-400 mt-1">Start a conversation with your team!</p>
        </div>
      ) : (
        <AnimatePresence initial={false}>
          <div className="space-y-5">
            {discussions.map((disc) => (
              <motion.div
                key={disc._id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'space-y-3 rounded-xl p-3 transition-colors',
                  disc.isPinned && 'bg-amber-50/60 ring-1 ring-amber-100 dark:bg-amber-500/5 dark:ring-amber-900/30'
                )}
              >
                <DiscussionBubble
                  disc={disc}
                  currentUserId={user?._id || ''}
                  isAdmin={isAdmin}
                  teamId={teamId}
                  members={members}
                  onReply={() => setReplyingTo(replyingTo === disc._id ? null : disc._id)}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onPin={handlePin}
                />

                {/* Replies */}
                {disc.replies && disc.replies.length > 0 && (
                  <div className="space-y-3 border-l-2 border-slate-100 pl-3 dark:border-slate-800">
                    {disc.replies.map((reply) => (
                      <DiscussionBubble
                        key={reply._id}
                        disc={reply}
                        isReply
                        parentId={disc._id}
                        currentUserId={user?._id || ''}
                        isAdmin={isAdmin}
                        teamId={teamId}
                        members={members}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onPin={handlePin}
                      />
                    ))}
                  </div>
                )}

                {/* Reply input */}
                <AnimatePresence>
                  {replyingTo === disc._id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="ml-10 space-y-2 overflow-hidden"
                    >
                      <MentionInput
                        value={replyBody}
                        onChange={setReplyBody}
                        onMentionsChange={setReplyMentions}
                        members={members}
                        placeholder="Write a reply…"
                        rows={2}
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleReply(disc._id)}
                          disabled={!replyBody.trim() || submitting}
                          className="flex items-center gap-1 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-40"
                        >
                          <Send className="h-3 w-3" />
                          Reply
                        </button>
                        <button
                          onClick={() => setReplyingTo(null)}
                          className="text-xs text-slate-400 hover:text-slate-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* New message composer */}
      <div className="space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <MentionInput
          value={newBody}
          onChange={(v) => {
            setNewBody(v);
            setNewMentions(extractMentions(v, members));
          }}
          onMentionsChange={setNewMentions}
          members={members}
          placeholder="Write a message… use @ to mention teammates"
          rows={3}
        />
        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={!newBody.trim() || submitting}
            className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-40"
          >
            <Send className="h-3 w-3" />
            Post
          </button>
        </div>
      </div>
    </div>
  );
};
