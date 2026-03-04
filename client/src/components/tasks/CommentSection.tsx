import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, CornerDownRight } from 'lucide-react';
import { User, Comment } from '@/types';
import { commentService } from '@/services/commentService';
import { useAuthStore } from '@/store/authStore';
import { Avatar } from '@/components/ui/Avatar';
import { MentionInput } from '@/components/ui/MentionInput';
import { cn, formatRelative } from '@/lib/utils';
import { getSocket } from '@/lib/socket';

interface CommentSectionProps {
  taskId: string;
  teamId: string;
  members: User[];
}

interface CommentBubbleProps {
  comment: Comment;
  isReply?: boolean;
  currentUserId: string;
  onReply?: () => void;
  onEdit: (commentId: string, body: string) => void;
  onDelete: (commentId: string) => void;
}

const CommentBubble = ({
  comment,
  isReply = false,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
}: CommentBubbleProps) => {
  const [editingBody, setEditingBody] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const isMe = comment.author._id === currentUserId;

  if (comment.isDeleted) {
    return (
      <div className={cn('flex items-center gap-2.5', isReply && 'ml-9')}>
        <p className="text-xs italic text-slate-400">[comment deleted]</p>
      </div>
    );
  }

  const startEdit = () => {
    setEditingBody(comment.body);
    setIsEditing(true);
  };

  const saveEdit = () => {
    if (editingBody.trim()) {
      onEdit(comment._id, editingBody.trim());
    }
    setIsEditing(false);
  };

  return (
    <div className={cn('flex gap-2.5', isReply && 'ml-9')}>
      <Avatar
        name={comment.author.name}
        src={comment.author.avatar}
        size="sm"
        className="mt-0.5 flex-shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {comment.author.name}
          </span>
          <span className="text-xs text-slate-400">{formatRelative(comment.createdAt)}</span>
          {comment.editedAt && (
            <span className="text-xs italic text-slate-400">(edited)</span>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editingBody}
              onChange={(e) => setEditingBody(e.target.value)}
              rows={2}
              autoFocus
              className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
            <div className="flex gap-3">
              <button
                onClick={saveEdit}
                className="text-xs font-medium text-brand-500 hover:text-brand-600"
              >
                Save
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-300">
            {comment.body}
          </p>
        )}

        {!isEditing && (
          <div className="mt-1.5 flex items-center gap-3">
            {!isReply && onReply && (
              <button
                onClick={onReply}
                className="flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-brand-500"
              >
                <CornerDownRight className="h-3 w-3" />
                Reply
              </button>
            )}
            {isMe && (
              <>
                <button
                  onClick={startEdit}
                  className="text-xs text-slate-400 transition-colors hover:text-brand-500"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(comment._id)}
                  className="text-xs text-slate-400 transition-colors hover:text-red-500"
                >
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

export const CommentSection = ({ taskId, teamId, members }: CommentSectionProps) => {
  const { user } = useAuthStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBody, setNewBody] = useState('');
  const [newMentions, setNewMentions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [replyMentions, setReplyMentions] = useState<string[]>([]);

  // Fetch on mount
  useEffect(() => {
    setLoading(true);
    commentService
      .getComments(taskId)
      .then(setComments)
      .finally(() => setLoading(false));
  }, [taskId]);

  // Socket listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleCreated = ({
      comment,
      taskId: tid,
    }: {
      comment: Comment;
      taskId: string;
    }) => {
      if (tid !== taskId) return;
      if (comment.parentComment) {
        setComments((prev) =>
          prev.map((c) =>
            c._id === comment.parentComment
              ? { ...c, replies: [...(c.replies || []), comment] }
              : c
          )
        );
      } else {
        setComments((prev) => [...prev, { ...comment, replies: [] }]);
      }
    };

    const handleUpdated = ({
      comment,
      taskId: tid,
    }: {
      comment: Comment;
      taskId: string;
    }) => {
      if (tid !== taskId) return;
      setComments((prev) =>
        prev.map((c) => {
          if (c._id === comment._id) return { ...c, ...comment };
          if (c.replies) {
            return {
              ...c,
              replies: c.replies.map((r) =>
                r._id === comment._id ? { ...r, ...comment } : r
              ),
            };
          }
          return c;
        })
      );
    };

    const handleDeleted = ({
      commentId,
      taskId: tid,
      parentCommentId,
    }: {
      commentId: string;
      taskId: string;
      parentCommentId: string | null;
    }) => {
      if (tid !== taskId) return;
      if (parentCommentId) {
        setComments((prev) =>
          prev.map((c) =>
            c._id === parentCommentId
              ? {
                  ...c,
                  replies: (c.replies || []).map((r) =>
                    r._id === commentId ? { ...r, isDeleted: true, body: '' } : r
                  ),
                }
              : c
          )
        );
      } else {
        setComments((prev) =>
          prev.map((c) =>
            c._id === commentId ? { ...c, isDeleted: true, body: '' } : c
          )
        );
      }
    };

    socket.on('comment:created', handleCreated);
    socket.on('comment:updated', handleUpdated);
    socket.on('comment:deleted', handleDeleted);

    return () => {
      socket.off('comment:created', handleCreated);
      socket.off('comment:updated', handleUpdated);
      socket.off('comment:deleted', handleDeleted);
    };
  }, [taskId]);

  const handleSubmit = async () => {
    if (!newBody.trim()) return;
    setSubmitting(true);
    try {
      await commentService.createComment({
        taskId,
        body: newBody.trim(),
        mentionedUserIds: newMentions,
      });
      setNewBody('');
      setNewMentions([]);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (parentCommentId: string) => {
    if (!replyBody.trim()) return;
    setSubmitting(true);
    try {
      await commentService.createComment({
        taskId,
        body: replyBody.trim(),
        parentCommentId,
        mentionedUserIds: replyMentions,
      });
      setReplyBody('');
      setReplyMentions([]);
      setReplyingTo(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (commentId: string, body: string) => {
    try {
      await commentService.updateComment(commentId, body);
    } catch {
      // socket will update state on success; on error, silently fail
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return;
    try {
      await commentService.deleteComment(commentId);
    } catch {}
  };

  return (
    <div className="space-y-5">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <MessageSquare className="h-3.5 w-3.5" />
        Comments
      </h3>

      {loading ? (
        <div className="flex justify-center py-6">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </div>
      ) : comments.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-400">
          No comments yet. Be the first to add one!
        </p>
      ) : (
        <AnimatePresence initial={false}>
          <div className="space-y-5">
            {comments.map((comment) => (
              <motion.div
                key={comment._id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <CommentBubble
                  comment={comment}
                  currentUserId={user?._id || ''}
                  onReply={() =>
                    setReplyingTo(replyingTo === comment._id ? null : comment._id)
                  }
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />

                {/* Replies */}
                {comment.replies && comment.replies.length > 0 && (
                  <div className="space-y-3 border-l-2 border-slate-100 pl-3 dark:border-slate-800">
                    {comment.replies.map((reply) => (
                      <CommentBubble
                        key={reply._id}
                        comment={reply}
                        isReply
                        currentUserId={user?._id || ''}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                )}

                {/* Reply input */}
                <AnimatePresence>
                  {replyingTo === comment._id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="ml-9 space-y-2 overflow-hidden"
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
                          onClick={() => handleReply(comment._id)}
                          disabled={!replyBody.trim() || submitting}
                          className="flex items-center gap-1 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-40"
                        >
                          <Send className="h-3 w-3" />
                          Send
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

      {/* New comment */}
      <div className="space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <MentionInput
          value={newBody}
          onChange={setNewBody}
          onMentionsChange={setNewMentions}
          members={members}
          placeholder="Add a comment… use @ to mention teammates"
          rows={3}
        />
        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={!newBody.trim() || submitting}
            className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-40"
          >
            <Send className="h-3 w-3" />
            Comment
          </button>
        </div>
      </div>
    </div>
  );
};
