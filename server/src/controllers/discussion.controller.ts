import { Request, Response } from 'express';
import { z } from 'zod';
import { Discussion } from '../models/Discussion.model';
import { Team } from '../models/Team.model';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { getIO } from '../config/socket';
import { createNotification } from '../services/notification.service';

const verifyTeamMember = async (teamId: string, userId: string) => {
  const team = await Team.findById(teamId);
  if (!team) throw new ApiError(404, 'Team not found.');
  const member = team.members.find((m) => m.user.toString() === userId);
  if (!member) throw new ApiError(403, 'Not a member of this team.');
  return { team, member };
};

export const getDiscussions = asyncHandler(async (req: Request, res: Response) => {
  const { teamId } = req.query as { teamId: string };
  if (!teamId) throw new ApiError(400, 'teamId is required.');

  const userId = req.user!._id.toString();
  await verifyTeamMember(teamId, userId);

  const all = await Discussion.find({ team: teamId })
    .populate('author', 'name avatar username')
    .populate('mentions', 'name avatar username')
    .sort({ isPinned: -1, createdAt: 1 });

  const topLevel = all.filter((d) => !d.parentDiscussion);
  const replies = all.filter((d) => d.parentDiscussion);

  const threaded = topLevel.map((d) => ({
    ...d.toObject(),
    replies: replies
      .filter((r) => r.parentDiscussion?.toString() === d._id.toString())
      .map((r) => r.toObject()),
  }));

  sendSuccess(res, { discussions: threaded });
});

export const createDiscussion = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    teamId: z.string(),
    body: z.string().min(1).max(4000),
    parentDiscussionId: z.string().optional().nullable(),
    mentionedUserIds: z.array(z.string()).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const userId = req.user!._id.toString();
  const { team } = await verifyTeamMember(parsed.data.teamId, userId);

  if (parsed.data.parentDiscussionId) {
    const parent = await Discussion.findById(parsed.data.parentDiscussionId);
    if (!parent || parent.team.toString() !== parsed.data.teamId) {
      throw new ApiError(400, 'Invalid parent discussion.');
    }
  }

  const discussion = await Discussion.create({
    team: parsed.data.teamId,
    author: userId,
    body: parsed.data.body,
    parentDiscussion: parsed.data.parentDiscussionId || null,
    mentions: parsed.data.mentionedUserIds || [],
  });

  const populated = await discussion.populate([
    { path: 'author', select: 'name avatar username' },
    { path: 'mentions', select: 'name avatar username' },
  ]);

  const io = getIO();
  if (io) {
    io.to(`team:${team._id}`).emit('discussion:created', {
      discussion: { ...populated.toObject(), replies: [] },
      teamId: parsed.data.teamId,
    });
  }

  // Send mention notifications (skip sender, skip duplicates)
  if (parsed.data.mentionedUserIds && parsed.data.mentionedUserIds.length > 0) {
    const uniqueMentions = [...new Set(parsed.data.mentionedUserIds)].filter(
      (uid) => uid !== userId
    );
    await Promise.allSettled(
      uniqueMentions.map((mentionedId) =>
        createNotification({
          recipientId: mentionedId,
          actorId: userId,
          type: 'mention',
          teamId: parsed.data.teamId,
          message: `mentioned you in a team discussion`,
          metadata: { discussionId: discussion._id.toString() },
        })
      )
    );
  }

  sendSuccess(res, { discussion: populated }, 'Discussion created.', 201);
});

export const updateDiscussion = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({ body: z.string().min(1).max(4000) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const userId = req.user!._id.toString();
  const discussion = await Discussion.findById(req.params.discussionId);
  if (!discussion) throw new ApiError(404, 'Discussion not found.');
  if (discussion.author.toString() !== userId)
    throw new ApiError(403, 'Only the author can edit this message.');
  if (discussion.isDeleted) throw new ApiError(400, 'Cannot edit a deleted message.');

  discussion.body = parsed.data.body;
  discussion.editedAt = new Date();
  await discussion.save();

  const populated = await discussion.populate([
    { path: 'author', select: 'name avatar username' },
    { path: 'mentions', select: 'name avatar username' },
  ]);

  const io = getIO();
  if (io) {
    io.to(`team:${discussion.team}`).emit('discussion:updated', {
      discussion: populated.toObject(),
      teamId: discussion.team.toString(),
    });
  }

  sendSuccess(res, { discussion: populated });
});

export const deleteDiscussion = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id.toString();
  const discussion = await Discussion.findById(req.params.discussionId);
  if (!discussion) throw new ApiError(404, 'Discussion not found.');

  const { team, member } = await verifyTeamMember(discussion.team.toString(), userId);

  const isAdmin = ['owner', 'admin'].includes(member.role);
  const isAuthor = discussion.author.toString() === userId;
  if (!isAdmin && !isAuthor)
    throw new ApiError(403, 'Only the author or admin can delete this message.');

  discussion.isDeleted = true;
  discussion.body = '';
  await discussion.save();

  const io = getIO();
  if (io) {
    io.to(`team:${team._id}`).emit('discussion:deleted', {
      discussionId: discussion._id.toString(),
      teamId: discussion.team.toString(),
      parentDiscussionId: discussion.parentDiscussion?.toString() || null,
    });
  }

  sendSuccess(res, null, 'Message deleted.');
});

export const togglePin = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id.toString();
  const discussion = await Discussion.findById(req.params.discussionId);
  if (!discussion) throw new ApiError(404, 'Discussion not found.');
  if (discussion.parentDiscussion) throw new ApiError(400, 'Cannot pin a reply.');

  const { team, member } = await verifyTeamMember(discussion.team.toString(), userId);

  const isAdmin = ['owner', 'admin', 'moderator'].includes(member.role);
  if (!isAdmin) throw new ApiError(403, 'Only admins and moderators can pin messages.');

  discussion.isPinned = !discussion.isPinned;
  await discussion.save();

  const io = getIO();
  if (io) {
    io.to(`team:${team._id}`).emit('discussion:pinned', {
      discussionId: discussion._id.toString(),
      isPinned: discussion.isPinned,
      teamId: discussion.team.toString(),
    });
  }

  sendSuccess(res, { isPinned: discussion.isPinned });
});
