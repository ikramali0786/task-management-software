import { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { Task } from '../models/Task.model';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { assertFeature } from '../utils/teamPlan';
import { verifyTeamMember } from './task.shared';

/**
 * Task export (CSV + branded PDF). Gated behind the `export` plan feature.
 */

// Escape a single CSV cell: wrap in quotes and double any embedded quotes.
const csvCell = (v: unknown): string => {
  const s = v == null ? '' : String(v);
  return `"${s.replace(/"/g, '""')}"`;
};

const fmtDate = (d: any): string => (d ? new Date(d).toISOString().slice(0, 10) : '');

const STATUS_LABEL: Record<string, string> = {
  todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done',
};

/** Stream a branded PDF of the team's tasks to the response. */
const exportTasksPdf = (res: Response, teamName: string, tasks: any[], filename: string) => {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  const BRAND = '#e8502e';
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const usable = right - left;

  // Title block
  doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(20).text('TaskFlow', left, 40);
  doc.fillColor('#211e19').fontSize(13).text(`${teamName} — Task export`, left, 66);
  doc.fillColor('#8a8580').font('Helvetica').fontSize(9)
    .text(`${tasks.length} tasks · generated ${new Date().toLocaleString()}`, left, 84);
  doc.moveTo(left, 102).lineTo(right, 102).strokeColor('#e5e1d8').stroke();

  const cols = [
    { label: '#', w: 34 },
    { label: 'Title', w: usable - 34 - 78 - 64 - 70 },
    { label: 'Status', w: 78 },
    { label: 'Priority', w: 64 },
    { label: 'Due', w: 70 },
  ];
  let y = 114;

  const drawHeaderRow = () => {
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#8a8580');
    let x = left;
    for (const c of cols) { doc.text(c.label.toUpperCase(), x, y, { width: c.w - 6, lineBreak: false }); x += c.w; }
    y += 13;
    doc.moveTo(left, y).lineTo(right, y).strokeColor('#e5e1d8').stroke();
    y += 5;
  };
  drawHeaderRow();

  doc.font('Helvetica').fontSize(9);
  for (const t of tasks) {
    if (y > doc.page.height - 50) { doc.addPage(); y = 40; drawHeaderRow(); }
    const cells = [
      String(t.identifier ?? ''),
      t.title || '',
      STATUS_LABEL[t.status] || t.status || '',
      t.priority || '',
      t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : '—',
    ];
    let x = left;
    for (let i = 0; i < cols.length; i++) {
      doc.fillColor(i === 0 ? '#8a8580' : '#211e19')
        .text(cells[i], x, y, { width: cols[i].w - 6, lineBreak: false, ellipsis: true });
      x += cols[i].w;
    }
    y += 18;
  }

  doc.end();
};

/* GET /tasks/export?teamId=… — download all team tasks as CSV (Business feature). */
export const exportTasks = asyncHandler(async (req: Request, res: Response) => {
  const { teamId } = req.query as Record<string, string>;
  if (!teamId) throw new ApiError(400, 'teamId is required.');

  const userId = req.user!._id.toString();
  const team = await verifyTeamMember(teamId, userId);
  await assertFeature(team, 'export', req.user!.email);

  const tasks = await Task.find({ team: teamId, isArchived: false })
    .sort({ identifier: 1 })
    .populate('assignees', 'name email')
    .populate('createdBy', 'name email');

  const safeName = (team.name || 'team').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const dateStr = new Date().toISOString().slice(0, 10);

  // ── PDF branch ─────────────────────────────────────────────────────────────
  if ((req.query.format as string) === 'pdf') {
    return exportTasksPdf(res, team.name || 'Team', tasks, `taskflow-${safeName}-${dateStr}.pdf`);
  }

  const header = [
    'ID', 'Title', 'Status', 'Priority', 'Assignees', 'Due Date',
    'Estimated (min)', 'Labels', 'Created By', 'Created At', 'Completed At', 'Description',
  ];

  const rows = tasks.map((t: any) => [
    t.identifier ?? '',
    t.title ?? '',
    t.status ?? '',
    t.priority ?? '',
    (t.assignees || []).map((a: any) => a?.name).filter(Boolean).join(', '),
    fmtDate(t.dueDate),
    t.estimatedMinutes ?? '',
    (t.labels || []).map((l: any) => l?.name).filter(Boolean).join(', '),
    t.createdBy?.name ?? '',
    fmtDate(t.createdAt),
    fmtDate(t.completedAt),
    (t.description ?? '').replace(/\s+/g, ' ').trim(),
  ]);

  const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  const filename = `taskflow-${safeName}-${dateStr}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('﻿' + csv); // UTF-8 BOM so Excel reads accents correctly
});
