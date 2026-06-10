import { Request, Response } from 'express';
import { Task } from '../models/Task.model';
import { User } from '../models/User.model';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { assertFeature } from '../utils/teamPlan';
import { verifyTeamMember } from './task.shared';

/**
 * Read-only reporting endpoints for tasks: stats, dashboard metrics, workload,
 * advanced analytics, and scheduling suggestions. Split out from the core task
 * controller so the hot CRUD path stays focused.
 */

/* GET /tasks/scheduling-suggestions?teamId=… — suggest due dates for open,
 * unscheduled tasks based on priority. */
export const getSchedulingSuggestions = asyncHandler(async (req: Request, res: Response) => {
  const { teamId } = req.query as Record<string, string>;
  if (!teamId) throw new ApiError(400, 'teamId is required.');
  await verifyTeamMember(teamId, req.user!._id.toString());

  const OFFSET_DAYS: Record<string, number> = { urgent: 2, high: 5, medium: 10, low: 21 };
  const RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

  const tasks = await Task.find({
    team: teamId,
    isArchived: false,
    status: { $ne: 'done' },
    dueDate: null,
  })
    .select('identifier title status priority assignees')
    .populate('assignees', 'name avatar')
    .limit(40)
    .lean();

  const now = Date.now();
  const suggestions = tasks
    .map((t: any) => ({
      taskId: t._id.toString(),
      identifier: t.identifier,
      title: t.title,
      status: t.status,
      priority: t.priority,
      assignees: (t.assignees || []).map((a: any) => ({ name: a.name, avatar: a.avatar || null })),
      suggestedDate: new Date(now + (OFFSET_DAYS[t.priority] ?? 10) * 86_400_000).toISOString(),
    }))
    .sort((a, b) => (RANK[a.priority] ?? 9) - (RANK[b.priority] ?? 9));

  sendSuccess(res, { suggestions });
});

/* GET /tasks/analytics?teamId=…&days=30 — advanced analytics (Business feature). */
export const getAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const { teamId } = req.query as Record<string, string>;
  if (!teamId) throw new ApiError(400, 'teamId is required.');

  const team = await verifyTeamMember(teamId, req.user!._id.toString());
  await assertFeature(team, 'advancedAnalytics', req.user!.email);

  const mongoose = require('mongoose');
  const teamObjId = new mongoose.Types.ObjectId(teamId);
  const days = Math.min(180, Math.max(7, parseInt((req.query.days as string) || '30', 10) || 30));
  const since = new Date(Date.now() - days * 86_400_000);
  since.setHours(0, 0, 0, 0);

  const [createdAgg, completedAgg, byPriorityAgg, contributorsAgg, cycleAgg] = await Promise.all([
    Task.aggregate([
      { $match: { team: teamObjId, isArchived: false, createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    ]),
    Task.aggregate([
      { $match: { team: teamObjId, isArchived: false, completedAt: { $ne: null, $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } }, count: { $sum: 1 } } },
    ]),
    Task.aggregate([
      { $match: { team: teamObjId, isArchived: false } },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]),
    Task.aggregate([
      { $match: { team: teamObjId, isArchived: false, completedAt: { $ne: null, $gte: since } } },
      { $unwind: '$assignees' },
      { $group: { _id: '$assignees', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]),
    Task.aggregate([
      { $match: { team: teamObjId, isArchived: false, completedAt: { $ne: null, $gte: since } } },
      { $project: { cycle: { $subtract: ['$completedAt', '$createdAt'] } } },
      { $group: { _id: null, avg: { $avg: '$cycle' } } },
    ]),
  ]);

  const createdMap: Record<string, number> = Object.fromEntries(createdAgg.map((d: any) => [d._id, d.count]));
  const completedMap: Record<string, number> = Object.fromEntries(completedAgg.map((d: any) => [d._id, d.count]));
  const series: Array<{ date: string; created: number; completed: number }> = [];
  for (let i = 0; i < days; i++) {
    const key = new Date(since.getTime() + i * 86_400_000).toISOString().slice(0, 10);
    series.push({ date: key, created: createdMap[key] || 0, completed: completedMap[key] || 0 });
  }

  const throughput = completedAgg.reduce((a: number, d: any) => a + d.count, 0);
  const createdTotal = createdAgg.reduce((a: number, d: any) => a + d.count, 0);
  const completionRate = createdTotal > 0 ? Math.round((throughput / createdTotal) * 100) : 0;
  const avgCycleDays = cycleAgg[0]?.avg ? Math.round((cycleAgg[0].avg / 86_400_000) * 10) / 10 : null;

  const contributorIds = contributorsAgg.map((c: any) => c._id);
  const users = await User.find({ _id: { $in: contributorIds } }).select('name avatar').lean();
  const uMap: Record<string, any> = Object.fromEntries(users.map((u: any) => [u._id.toString(), u]));
  const topContributors = contributorsAgg.map((c: any) => ({
    id: c._id.toString(),
    name: uMap[c._id.toString()]?.name || 'Unknown',
    avatar: uMap[c._id.toString()]?.avatar || null,
    completed: c.count,
  }));

  const byPriority = byPriorityAgg.reduce((acc: Record<string, number>, i: any) => { acc[i._id] = i.count; return acc; }, {});

  sendSuccess(res, { analytics: { days, series, throughput, completionRate, avgCycleDays, byPriority, topContributors } });
});

export const getTaskStats = asyncHandler(async (req: Request, res: Response) => {
  const { teamId } = req.query as { teamId: string };
  if (!teamId) throw new ApiError(400, 'teamId is required.');

  await verifyTeamMember(teamId, req.user!._id.toString());

  const now = new Date();

  const [statusCounts, priorityCounts, overdue] = await Promise.all([
    Task.aggregate([
      { $match: { team: new (require('mongoose').Types.ObjectId)(teamId), isArchived: false } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Task.aggregate([
      { $match: { team: new (require('mongoose').Types.ObjectId)(teamId), isArchived: false } },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]),
    Task.countDocuments({
      team: teamId,
      isArchived: false,
      status: { $ne: 'done' },
      dueDate: { $lt: now },
    }),
  ]);

  const stats = {
    byStatus: statusCounts.reduce((acc: Record<string, number>, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {}),
    byPriority: priorityCounts.reduce((acc: Record<string, number>, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {}),
    overdue,
  };

  sendSuccess(res, { stats });
});

/* GET /tasks/dashboard-metrics?teamId=&days=30&tz=America/New_York — lightweight,
 * ungated dashboard analytics computed server-side. Trend day-buckets are aligned
 * to the caller's timezone so "today" is the user's local day, not UTC. */
export const getDashboardMetrics = asyncHandler(async (req: Request, res: Response) => {
  const { teamId } = req.query as Record<string, string>;
  if (!teamId) throw new ApiError(400, 'teamId is required.');
  await verifyTeamMember(teamId, req.user!._id.toString());

  const mongoose = require('mongoose');
  const teamObjId = new mongoose.Types.ObjectId(teamId);
  const dayMs = 86_400_000;
  const days = Math.min(90, Math.max(7, parseInt((req.query.days as string) || '30', 10) || 30));

  // Validate the requested timezone; fall back to UTC if it isn't a real IANA zone.
  let tz = (req.query.tz as string) || 'UTC';
  let fmt: Intl.DateTimeFormat;
  try { fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }); }
  catch { tz = 'UTC'; fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }); }
  const keyOf = (ms: number) => fmt.format(new Date(ms)); // 'YYYY-MM-DD' in tz

  const now = Date.now();
  const currentKeys: string[] = []; for (let i = days - 1; i >= 0; i--) currentKeys.push(keyOf(now - i * dayMs));
  const prevKeys = new Set<string>(); for (let i = 2 * days - 1; i >= days; i--) prevKeys.add(keyOf(now - i * dayMs));
  const matchSince = new Date(now - (2 * days + 1) * dayMs);
  const curStart = new Date(now - days * dayMs);
  const prevStart = new Date(now - 2 * days * dayMs);

  const dayGroup = (field: string) => ([
    { $match: { team: teamObjId, isArchived: false, [field]: { $ne: null, $gte: matchSince } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: `$${field}`, timezone: tz } }, count: { $sum: 1 } } },
  ]);
  const cycleAvg = (lo: Date, hi: Date | null) => ([
    { $match: { team: teamObjId, isArchived: false, completedAt: hi ? { $gte: lo, $lt: hi } : { $ne: null, $gte: lo } } },
    { $project: { cycle: { $subtract: ['$completedAt', '$createdAt'] } } },
    { $group: { _id: null, avg: { $avg: '$cycle' } } },
  ]);

  const [completedAgg, createdAgg, cycleAgg, prevCycleAgg] = await Promise.all([
    Task.aggregate(dayGroup('completedAt')),
    Task.aggregate(dayGroup('createdAt')),
    Task.aggregate(cycleAvg(curStart, null)),
    Task.aggregate(cycleAvg(prevStart, curStart)),
  ]);

  const completedMap: Record<string, number> = Object.fromEntries(completedAgg.map((d: any) => [d._id, d.count]));
  const createdMap: Record<string, number> = Object.fromEntries(createdAgg.map((d: any) => [d._id, d.count]));
  const trend = currentKeys.map((k) => ({ date: k, count: completedMap[k] || 0 }));
  const created = currentKeys.map((k) => ({ date: k, count: createdMap[k] || 0 }));
  const sum = (map: Record<string, number>, keys: Iterable<string>) => { let s = 0; for (const k of keys) s += map[k] || 0; return s; };
  const throughput = sum(completedMap, currentKeys);
  const prevThroughput = sum(completedMap, prevKeys);
  const createdThroughput = sum(createdMap, currentKeys);
  const prevCreated = sum(createdMap, prevKeys);
  const toDays = (v: any) => (v ? Math.round((v / dayMs) * 10) / 10 : null);
  const avgCycleDays = toDays(cycleAgg[0]?.avg);
  const prevAvgCycleDays = toDays(prevCycleAgg[0]?.avg);

  sendSuccess(res, { metrics: { days, tz, trend, created, throughput, prevThroughput, createdThroughput, prevCreated, avgCycleDays, prevAvgCycleDays } });
});

export const getWorkload = asyncHandler(async (req: Request, res: Response) => {
  const { teamId } = req.query as { teamId: string };
  if (!teamId) throw new ApiError(400, 'teamId is required.');

  await verifyTeamMember(teamId, req.user!._id.toString());

  const { Types } = require('mongoose');
  const teamOid = new Types.ObjectId(teamId);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [workload, completedTodayRaw, progressRaw] = await Promise.all([
    Task.aggregate([
      { $match: { team: teamOid, isArchived: false } },
      { $unwind: { path: '$assignees', preserveNullAndEmptyArrays: false } },
      { $group: { _id: { user: '$assignees', status: '$status' }, count: { $sum: 1 } } },
      {
        $group: {
          _id: '$_id.user',
          statusBreakdown: { $push: { status: '$_id.status', count: '$count' } },
          total: { $sum: '$count' },
        },
      },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $sort: { total: -1 } },
      { $project: { _id: 0, user: { _id: 1, name: 1, avatar: 1, email: 1, username: 1 }, total: 1, statusBreakdown: 1 } },
    ]),
    // Tasks completed today per assignee
    Task.aggregate([
      { $match: { team: teamOid, isArchived: false, status: 'done', completedAt: { $gte: todayStart, $lte: todayEnd } } },
      { $unwind: { path: '$assignees', preserveNullAndEmptyArrays: false } },
      { $group: { _id: '$assignees', count: { $sum: 1 } } },
    ]),
    // Overall progress (done / total)
    Task.aggregate([
      { $match: { team: teamOid, isArchived: false } },
      { $group: { _id: null, total: { $sum: 1 }, done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } } } },
    ]),
  ]);

  // Build map { userId -> completedToday }
  const completedTodayMap: Record<string, number> = {};
  for (const r of completedTodayRaw) {
    completedTodayMap[r._id.toString()] = r.count;
  }

  // Enrich workload with completedToday
  const enriched = workload.map((w: any) => ({
    ...w,
    completedToday: completedTodayMap[w.user._id.toString()] || 0,
  }));

  const projectProgress = progressRaw[0] || { total: 0, done: 0 };

  sendSuccess(res, { workload: enriched, projectProgress: { total: projectProgress.total, done: projectProgress.done } });
});
