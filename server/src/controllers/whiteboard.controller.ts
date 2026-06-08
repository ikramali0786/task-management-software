import { Request, Response } from 'express';
import { z } from 'zod';
import { Whiteboard } from '../models/Whiteboard.model';
import { Team } from '../models/Team.model';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { hasPermission } from '../utils/permissions';

const verifyMember = async (teamId: string, userId: string) => {
  const team = await Team.findById(teamId);
  if (!team) throw new ApiError(404, 'Team not found.');
  const member = team.members.find((m) => m.user.toString() === userId);
  if (!member) throw new ApiError(403, 'Not a member of this team.');
  return team;
};

/* GET /whiteboard?teamId=… — load (creating an empty board on first access). */
export const getWhiteboard = asyncHandler(async (req: Request, res: Response) => {
  const { teamId } = req.query as Record<string, string>;
  if (!teamId) throw new ApiError(400, 'teamId is required.');
  await verifyMember(teamId, req.user!._id.toString());

  const board = await Whiteboard.findOne({ team: teamId }).select('elements updatedAt');
  sendSuccess(res, { elements: board?.elements ?? [], updatedAt: board?.updatedAt ?? null });
});

/* PUT /whiteboard?teamId=… — save the whole board (last-writer-wins). */
export const saveWhiteboard = asyncHandler(async (req: Request, res: Response) => {
  const { teamId } = req.query as Record<string, string>;
  if (!teamId) throw new ApiError(400, 'teamId is required.');

  const schema = z.object({ elements: z.array(z.any()).max(5000) });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(400, 'Invalid board payload.');

  const userId = req.user!._id.toString();
  const team = await verifyMember(teamId, userId);
  // Read-only members (viewers / guests) can view but not persist changes.
  if (!hasPermission(team, userId, 'commentOnTasks')) {
    throw new ApiError(403, 'You have read-only access to this whiteboard.', { code: 'PERMISSION_DENIED' });
  }

  const board = await Whiteboard.findOneAndUpdate(
    { team: teamId },
    { $set: { elements: parsed.data.elements, updatedBy: req.user!._id } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Live propagation happens via socket `whiteboard:op` events (element-level);
  // this endpoint only persists the merged result for fresh loads.
  sendSuccess(res, { updatedAt: board.updatedAt }, 'Saved.');
});
