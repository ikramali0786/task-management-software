import { Request, Response } from 'express';
import { z } from 'zod';
import { Doc } from '../models/Doc.model';
import { Team } from '../models/Team.model';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { hasPermission } from '../utils/permissions';
import { getIO } from '../config/socket';

const verifyMember = async (teamId: string, userId: string) => {
  const team = await Team.findById(teamId);
  if (!team) throw new ApiError(404, 'Team not found.');
  const member = team.members.find((m) => m.user.toString() === userId);
  if (!member) throw new ApiError(403, 'Not a member of this team.');
  return team;
};

const assertWrite = (team: any, userId: string) => {
  if (!hasPermission(team, userId, 'commentOnTasks')) {
    throw new ApiError(403, 'You have read-only access to this team’s docs.', { code: 'PERMISSION_DENIED' });
  }
};

// Tree-node shape (no content) for the sidebar listing.
const node = (d: any) => ({
  _id: d._id, title: d.title, icon: d.icon, parent: d.parent, position: d.position,
  updatedAt: d.updatedAt, updatedBy: d.updatedBy,
});
const full = (d: any) => ({ ...node(d), content: d.content, createdBy: d.createdBy, createdAt: d.createdAt });

const broadcast = (teamId: string, event: string, payload: unknown) => {
  const io = getIO();
  if (io) io.to(`team:${teamId}`).emit(event, payload);
};

/* GET /docs?teamId=… — the team's doc tree (titles only, no content). */
export const listDocs = asyncHandler(async (req: Request, res: Response) => {
  const { teamId } = req.query as Record<string, string>;
  if (!teamId) throw new ApiError(400, 'teamId is required.');
  await verifyMember(teamId, req.user!._id.toString());
  const docs = await Doc.find({ team: teamId, isArchived: false })
    .select('title icon parent position updatedAt updatedBy')
    .populate('updatedBy', 'name avatar')
    .sort({ position: 1, createdAt: 1 });
  sendSuccess(res, { docs: docs.map(node) });
});

/* GET /docs/:docId — one page with content. */
export const getDoc = asyncHandler(async (req: Request, res: Response) => {
  const doc = await Doc.findById(req.params.docId).populate('updatedBy', 'name avatar').populate('createdBy', 'name avatar');
  if (!doc || doc.isArchived) throw new ApiError(404, 'Doc not found.');
  await verifyMember(doc.team.toString(), req.user!._id.toString());
  sendSuccess(res, { doc: full(doc) });
});

/* POST /docs?teamId=… — create a page (optionally nested under a parent). */
export const createDoc = asyncHandler(async (req: Request, res: Response) => {
  const { teamId } = req.query as Record<string, string>;
  if (!teamId) throw new ApiError(400, 'teamId is required.');
  const userId = req.user!._id.toString();
  const team = await verifyMember(teamId, userId);
  assertWrite(team, userId);

  const schema = z.object({
    title: z.string().trim().max(200).optional(),
    icon: z.string().max(8).optional(),
    parent: z.string().nullable().optional(),
    content: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(400, 'Invalid doc payload.');

  const parent = parsed.data.parent || null;
  const count = await Doc.countDocuments({ team: teamId, parent, isArchived: false });
  const doc = await Doc.create({
    team: teamId, title: parsed.data.title || 'Untitled', icon: parsed.data.icon || '📄',
    content: parsed.data.content || '', parent, position: count,
    createdBy: req.user!._id, updatedBy: req.user!._id,
  });
  const populated = await doc.populate('updatedBy', 'name avatar');
  broadcast(teamId, 'doc:changed', { teamId });
  sendSuccess(res, { doc: full(populated) }, 'Doc created.', 201);
});

/* PATCH /docs/:docId — update title / icon / content / parent / position. */
export const updateDoc = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id.toString();
  const doc = await Doc.findById(req.params.docId);
  if (!doc || doc.isArchived) throw new ApiError(404, 'Doc not found.');
  const team = await verifyMember(doc.team.toString(), userId);
  assertWrite(team, userId);

  const schema = z.object({
    title: z.string().trim().max(200).optional(),
    icon: z.string().max(8).optional(),
    content: z.string().optional(),
    parent: z.string().nullable().optional(),
    position: z.number().optional(),
  });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(400, 'Invalid doc payload.');
  const d = parsed.data;

  if (d.title !== undefined) doc.title = d.title || 'Untitled';
  if (d.icon !== undefined) doc.icon = d.icon || '📄';
  if (d.content !== undefined) doc.content = d.content;
  if (d.position !== undefined) doc.position = d.position;
  if (d.parent !== undefined) {
    const next = d.parent || null;
    if (next && next === doc._id.toString()) throw new ApiError(400, 'A doc cannot be its own parent.');
    doc.parent = next as any;
  }
  doc.updatedBy = req.user!._id;
  await doc.save();
  const populated = await doc.populate('updatedBy', 'name avatar');
  broadcast(doc.team.toString(), 'doc:changed', { teamId: doc.team.toString(), docId: doc._id.toString() });
  sendSuccess(res, { doc: full(populated) }, 'Saved.');
});

/* DELETE /docs/:docId — archive a page and all its descendants. */
export const deleteDoc = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id.toString();
  const doc = await Doc.findById(req.params.docId);
  if (!doc || doc.isArchived) throw new ApiError(404, 'Doc not found.');
  const team = await verifyMember(doc.team.toString(), userId);
  assertWrite(team, userId);

  // Collect the subtree (this doc + all descendants) and archive it.
  const all = await Doc.find({ team: doc.team, isArchived: false }).select('_id parent');
  const childrenOf = new Map<string, string[]>();
  for (const d of all) { const p = d.parent ? d.parent.toString() : 'root'; if (!childrenOf.has(p)) childrenOf.set(p, []); childrenOf.get(p)!.push(d._id.toString()); }
  const toArchive: string[] = []; const stack = [doc._id.toString()];
  while (stack.length) { const id = stack.pop()!; toArchive.push(id); stack.push(...(childrenOf.get(id) || [])); }
  await Doc.updateMany({ _id: { $in: toArchive } }, { $set: { isArchived: true } });
  broadcast(doc.team.toString(), 'doc:changed', { teamId: doc.team.toString() });
  sendSuccess(res, { deleted: toArchive.length }, 'Doc deleted.');
});
