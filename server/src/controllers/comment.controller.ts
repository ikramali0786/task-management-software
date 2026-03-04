import mongoose from 'mongoose';
import { Request, Response } from 'express';
import { z } from 'zod';
import { Comment } from '../models/Comment.model';
import { Task } from '../models/Task.model';
import { Team } from '../models/Team.model';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { createNotification } from '../services/notification.service';
import { getIO } from '../config/socket';

const verifyTaskAccess = async (taskId: string, userId: string) => {
  const task = await Task.findById(taskId);
  if (!task) throw new ApiError(404, 'Task not found.');
  const team = await Team.findById(task.team);
  if (!team) throw new ApiError(404, 'Team not found.');
  const member = team.members.find((m) => m.user.toString() === userId);
  if (!member) throw new ApiError(403, 'Not a member of this team.');
  return { task, team, member };
};

export const getComments = asyncHandler(async (req: Request, res: Response) => {
  const { taskId } = req.query as { taskId: string };
  if (!taskId) throw new ApiError(400, 'taskId is required.');

  const userId = req.user!._id.toString();
  await verifyTaskAccess(taskId, userId);

  const allComments = await Comment.find({ task: taskId })
    .populate('author', 'name avatar username')
    .populate('mentions', 'name avatar username')
    .sort({ createdAt: 1 });

  // Group into top-level + replies
  const topLevel = allComments.filter((c) => !c.parentComment);
  const replies = allComments.filter((c) => c.parentComment);

  const threaded = topLevel.map((comment) => ({
    ...comment.toObject(),
    replies: replies
      .filter((r) => r.parentComment?.toString() === comment._id.toString())
      .map((r) => r.toObject()),
  }));

  sendSuccess(res, { comments: threaded });
});

export const createComment = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    taskId: z.string(),
    body: z.string().min(1).max(2000),
    parentCommentId: z.string().optional().nullable(),
    mentionedUserIds: z.array(z.string()).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const userId = req.user!._id.toString();
  const { task, team } = await verifyTaskAccess(parsed.data.taskId, userId);

  // Validate parentComment belongs to same task
  if (parsed.data.parentCommentId) {
    const parent = await Comment.findById(parsed.data.parentCommentId);
    if (!parent || parent.task.toString() !== parsed.data.taskId) {
      throw new ApiError(400, 'Invalid parent comment.');
    }
  }

  const comment = await Comment.create({
    task: parsed.data.taskId,
    author: userId,
    body: parsed.data.body,
    parentComment: parsed.data.parentCommentId || null,
    mentions: parsed.data.mentionedUserIds || [],
  });

  const populated = await comment.populate([
    { path: 'author', select: 'name avatar username' },
    { path: 'mentions', select: 'name avatar username' },
  ]);

  // Auto-add mentioned users to task assignees if not already assigned
  const mentionedUserIds = parsed.data.mentionedUserIds || [];
  const currentAssignees = task.assignees.map((a) => a.toString());
  const newAssignees = mentionedUserIds.filter(
    (id) => !currentAssignees.includes(id) && id !== userId
  );

  if (newAssignees.length > 0) {
    task.assignees = [
      ...task.assignees,
      ...newAssignees.map((id) => new mongoose.Types.ObjectId(id)),
    ] as any;
    await task.save();

    const io = getIO();
    if (io) {
      io.to(`team:${team._id}`).emit('task:updated', {
        taskId: task._id,
        changes: { assignees: [...currentAssignees, ...newAssignees] },
      });
    }

    // Notify newly mentioned/assigned users
    for (const assigneeId of newAssignees) {
      await createNotification({
        recipientId: assigneeId,
        actorId: userId,
        type: 'task_assigned',
        taskId: task._id.toString(),
        teamId: team._id.toString(),
        message: `${req.user!.name} mentioned and assigned you to "${task.title}".`,
        metadata: { taskTitle: task.title },
      });
    }
  }

  const io = getIO();
  if (io) {
    io.to(`team:${team._id}`).emit('comment:created', {
      comment: { ...populated.toObject(), replies: [] },
      taskId: parsed.data.taskId,
    });
  }

  sendSuccess(res, { comment: populated }, 'Comment created.', 201);
});

export const updateComment = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({ body: z.string().min(1).max(2000) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const userId = req.user!._id.toString();
  const comment = await Comment.findById(req.params.commentId);
  if (!comment) throw new ApiError(404, 'Comment not found.');
  if (comment.author.toString() !== userId)
    throw new ApiError(403, 'Only the author can edit this comment.');
  if (comment.isDeleted) throw new ApiError(400, 'Cannot edit a deleted comment.');

  comment.body = parsed.data.body;
  comment.editedAt = new Date();
  await comment.save();

  const populated = await comment.populate([
    { path: 'author', select: 'name avatar username' },
    { path: 'mentions', select: 'name avatar username' },
  ]);

  const task = await Task.findById(comment.task);
  if (task) {
    const io = getIO();
    if (io) {
      io.to(`team:${task.team}`).emit('comment:updated', {
        comment: populated.toObject(),
        taskId: comment.task.toString(),
      });
    }
  }

  sendSuccess(res, { comment: populated });
});

export const deleteComment = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id.toString();
  const comment = await Comment.findById(req.params.commentId);
  if (!comment) throw new ApiError(404, 'Comment not found.');

  const task = await Task.findById(comment.task);
  if (!task) throw new ApiError(404, 'Task not found.');
  const team = await Team.findById(task.team);
  if (!team) throw new ApiError(404, 'Team not found.');

  const member = team.members.find((m) => m.user.toString() === userId);
  if (!member) throw new ApiError(403, 'Not a member of this team.');

  const isAdmin = ['owner', 'admin'].includes(member.role);
  const isAuthor = comment.author.toString() === userId;
  if (!isAdmin && !isAuthor)
    throw new ApiError(403, 'Only the author or admin can delete this comment.');

  comment.isDeleted = true;
  comment.body = '';
  await comment.save();

  const io = getIO();
  if (io) {
    io.to(`team:${task.team}`).emit('comment:deleted', {
      commentId: comment._id.toString(),
      taskId: comment.task.toString(),
      parentCommentId: comment.parentComment?.toString() || null,
    });
  }

  sendSuccess(res, null, 'Comment deleted.');
});
