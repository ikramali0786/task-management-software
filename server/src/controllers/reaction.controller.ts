import { Request, Response } from 'express';
import { z } from 'zod';
import { Reaction } from '../models/Reaction.model';
import { Team } from '../models/Team.model';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { getIO } from '../config/socket';

const verifyTeamMember = async (teamId: string, userId: string) => {
  const team = await Team.findById(teamId);
  if (!team) throw new ApiError(404, 'Team not found.');
  const member = team.members.find((m) => m.user.toString() === userId);
  if (!member) throw new ApiError(403, 'Not a member of this team.');
  return { team, member };
};

const groupReactions = (reactions: any[], currentUserId: string) => {
  const map: Record<string, { emoji: string; count: number; users: string[]; reacted: boolean }> = {};
  for (const r of reactions) {
    const uid = r.user.toString();
    if (!map[r.emoji]) {
      map[r.emoji] = { emoji: r.emoji, count: 0, users: [], reacted: false };
    }
    map[r.emoji].count++;
    map[r.emoji].users.push(uid);
    if (uid === currentUserId) map[r.emoji].reacted = true;
  }
  return Object.values(map).sort((a, b) => b.count - a.count);
};

export const getReactions = asyncHandler(async (req: Request, res: Response) => {
  const { resourceId } = req.query as { resourceId: string };
  if (!resourceId) throw new ApiError(400, 'resourceId is required.');
  const userId = req.user!._id.toString();

  const reactions = await Reaction.find({ resource: resourceId });
  const grouped = groupReactions(reactions, userId);

  sendSuccess(res, { reactions: grouped });
});

export const toggleReaction = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    resourceId: z.string(),
    resourceType: z.enum(['task', 'comment', 'discussion']),
    emoji: z.string().min(1).max(8),
    teamId: z.string(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const userId = req.user!._id.toString();
  const { resourceId, resourceType, emoji, teamId } = parsed.data;

  await verifyTeamMember(teamId, userId);

  const existing = await Reaction.findOne({ resource: resourceId, user: userId, emoji });
  let added: boolean;

  if (existing) {
    await existing.deleteOne();
    added = false;
  } else {
    await Reaction.create({ resource: resourceId, resourceType, team: teamId, user: userId, emoji });
    added = true;
  }

  // Fetch fresh grouped reactions
  const allReactions = await Reaction.find({ resource: resourceId });
  const grouped = groupReactions(allReactions, userId);

  const io = getIO();
  if (io) {
    io.to(`team:${teamId}`).emit('reaction:toggled', {
      resourceId,
      reactions: grouped,
    });
  }

  sendSuccess(res, { reactions: grouped, added });
});
