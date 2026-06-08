import { useEffect, useRef, useState } from 'react';
import {
  MousePointer2, Hand, StickyNote, Square, Circle, Pencil, Type, Trash2,
  Eraser, Loader2, Check, Presentation, Eye, Undo2, Redo2,
  Copy, ArrowUpToLine, ArrowDownToLine, Lock, Unlock,
} from 'lucide-react';
import { useTeamStore } from '@/store/teamStore';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { usePermissions } from '@/hooks/usePermissions';
import { getSocket } from '@/lib/socket';
import { whiteboardService } from '@/services/whiteboardService';
import { cn } from '@/lib/utils';

type Tool = 'select' | 'pan' | 'note' | 'rect' | 'ellipse' | 'pen' | 'text' | 'eraser';
type Base = { id: string; color: string; locked?: boolean };
type Box = Base & { type: 'note' | 'rect' | 'ellipse'; x: number; y: number; w: number; h: number; text?: string };
type Txt = Base & { type: 'text'; x: number; y: number; text: string; size: number };
type Path = Base & { type: 'path'; points: number[][]; width: number };
type El = Box | Txt | Path;

const COLORS = ['#e8502e', '#f59e0b', '#22c55e', '#0ea5e9', '#8b5cf6', '#211e19'];
const NOTE_FILL = '#fde68a';
const uid = () => Math.random().toString(36).slice(2, 10);
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const pathD = (pts: number[][]) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]} ${p[1]}`).join(' ');
const isBox = (el: El): el is Box => el.type === 'note' || el.type === 'rect' || el.type === 'ellipse';
const pathBounds = (pts: number[][]) => {
  const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
};
const bboxOf = (el: El) => {
  if (el.type === 'path') return pathBounds(el.points);
  if (el.type === 'text') return { x: el.x, y: el.y - el.size, w: Math.max(40, el.text.length * el.size * 0.6), h: el.size + 6 };
  return { x: el.x, y: el.y, w: el.w, h: el.h };
};
const intersects = (a: any, b: any) => !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);

const TOOLS: { id: Tool; icon: React.ElementType; label: string }[] = [
  { id: 'select', icon: MousePointer2, label: 'Select' },
  { id: 'pan', icon: Hand, label: 'Pan' },
  { id: 'note', icon: StickyNote, label: 'Sticky note' },
  { id: 'rect', icon: Square, label: 'Rectangle' },
  { id: 'ellipse', icon: Circle, label: 'Ellipse' },
  { id: 'pen', icon: Pencil, label: 'Pen' },
  { id: 'text', icon: Type, label: 'Text' },
  { id: 'eraser', icon: Eraser, label: 'Eraser' },
];

export const WhiteboardPage = () => {
  const { activeTeam } = useTeamStore();
  const { user } = useAuthStore();
  const { addToast, showConfirm } = useUIStore();
  const { can } = usePermissions();

  const currentMember = activeTeam?.members.find((m: any) => (m.user?._id || m.user) === user?._id);
  const canEdit = can('commentOnTasks') && !currentMember?.isGuest;

  const [elements, setElements] = useState<El[]>([]);
  const [tool, setTool] = useState<Tool>('select');
  const [color, setColor] = useState(COLORS[0]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [loading, setLoading] = useState(true);

  const svgRef = useRef<SVGSVGElement>(null);
  const offsetRef = useRef(offset); offsetRef.current = offset;
  const elsRef = useRef(elements); elsRef.current = elements;
  const selRef = useRef(selectedIds); selRef.current = selectedIds;
  const opRef = useRef<any>(null);
  const loadedRef = useRef(false);
  const skipSaveRef = useRef(false);
  const dirtyRef = useRef(false);
  const undoRef = useRef<El[][]>([]);
  const redoRef = useRef<El[][]>([]);
  const clipRef = useRef<El[]>([]);

  // ── Live ops ───────────────────────────────────────────────────────────────
  const emitOp = (op: any) => { if (activeTeam) getSocket()?.emit('whiteboard:op', { teamId: activeTeam._id, op }); };
  const emitUpsert = (id: string) => { const el = elsRef.current.find((e) => e.id === id); if (el) emitOp({ kind: 'upsert', el }); };
  const broadcastDiff = (prev: El[], next: El[]) => {
    const pm = new Map(prev.map((e) => [e.id, JSON.stringify(e)]));
    const nm = new Map(next.map((e) => [e.id, e]));
    for (const e of next) if (pm.get(e.id) !== JSON.stringify(e)) emitOp({ kind: 'upsert', el: e });
    for (const e of prev) if (!nm.has(e.id)) emitOp({ kind: 'delete', id: e.id });
  };

  // ── History ────────────────────────────────────────────────────────────────
  const pushHistory = () => { undoRef.current.push(clone(elsRef.current)); if (undoRef.current.length > 80) undoRef.current.shift(); redoRef.current = []; };
  const undo = () => {
    if (!undoRef.current.length) return;
    const prev = elsRef.current; const restored = undoRef.current.pop()!;
    redoRef.current.push(clone(prev)); setElements(restored); setSelectedIds([]); broadcastDiff(prev, restored);
  };
  const redo = () => {
    if (!redoRef.current.length) return;
    const prev = elsRef.current; const restored = redoRef.current.pop()!;
    undoRef.current.push(clone(prev)); setElements(restored); setSelectedIds([]); broadcastDiff(prev, restored);
  };

  // ── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeTeam) { setLoading(false); return; }
    let active = true; loadedRef.current = false; setLoading(true);
    whiteboardService.get(activeTeam._id)
      .then((d) => { if (active) setElements(Array.isArray(d.elements) ? d.elements : []); })
      .catch(() => {})
      .finally(() => { if (active) { loadedRef.current = true; setLoading(false); } });
    return () => { active = false; };
  }, [activeTeam?._id]);

  // ── Receive live ops ───────────────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket(); if (!socket) return;
    const apply = (op: any) => {
      skipSaveRef.current = true;
      if (op.kind === 'upsert') setElements((prev) => { const i = prev.findIndex((e) => e.id === op.el.id); if (i >= 0) { const c = [...prev]; c[i] = op.el; return c; } return [...prev, op.el]; });
      else if (op.kind === 'delete') setElements((prev) => prev.filter((e) => e.id !== op.id));
      else if (op.kind === 'clear') setElements([]);
      else if (op.kind === 'order') setElements((prev) => { const m = new Map(prev.map((e) => [e.id, e])); const ordered = op.ids.map((id: string) => m.get(id)).filter(Boolean); for (const e of prev) if (!op.ids.includes(e.id)) ordered.push(e); return ordered as El[]; });
    };
    socket.on('whiteboard:op', apply);
    return () => { socket.off('whiteboard:op', apply); };
  }, []);

  // ── Autosave (editors only) ────────────────────────────────────────────────
  useEffect(() => {
    if (!loadedRef.current || !activeTeam || !canEdit) return;
    if (skipSaveRef.current) { skipSaveRef.current = false; return; }
    dirtyRef.current = true; setSaving('saving');
    const h = setTimeout(async () => {
      try { await whiteboardService.save(activeTeam._id, elsRef.current); dirtyRef.current = false; setSaving('saved'); setTimeout(() => setSaving('idle'), 1200); }
      catch { setSaving('idle'); }
    }, 700);
    return () => clearTimeout(h);
  }, [elements, activeTeam?._id, canEdit]);
  useEffect(() => () => { if (dirtyRef.current && activeTeam && canEdit) whiteboardService.save(activeTeam._id, elsRef.current).catch(() => {}); }, [activeTeam?._id, canEdit]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const pt = (e: React.PointerEvent | PointerEvent) => { const r = svgRef.current!.getBoundingClientRect(); return { x: e.clientX - r.left - offsetRef.current.x, y: e.clientY - r.top - offsetRef.current.y }; };
  const patch = (id: string, p: Partial<El>) => setElements((els) => els.map((el) => (el.id === id ? ({ ...el, ...p } as El) : el)));
  const translateEl = (el: El, dx: number, dy: number): El =>
    el.type === 'path' ? { ...el, points: el.points.map((q) => [q[0] + dx, q[1] + dy]) } : ({ ...el, x: (el as any).x + dx, y: (el as any).y + dy } as El);

  // ── Canvas pointer ─────────────────────────────────────────────────────────
  const onBgPointerDown = (e: React.PointerEvent) => {
    if (editingId) return;
    setCtxMenu(null);
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = pt(e);
    if (tool === 'pan') { opRef.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y }; return; }
    if (!canEdit) { setSelectedIds([]); return; }
    if (tool === 'select') { if (!e.shiftKey) setSelectedIds([]); opRef.current = { kind: 'marquee', sx: p.x, sy: p.y }; setMarquee({ x: p.x, y: p.y, w: 0, h: 0 }); return; }
    if (tool === 'eraser') return;
    pushHistory();
    if (tool === 'note') { const el: Box = { id: uid(), type: 'note', x: p.x, y: p.y, w: 168, h: 120, color: NOTE_FILL, text: '' }; setElements((els) => [...els, el]); setSelectedIds([el.id]); setEditingId(el.id); return; }
    if (tool === 'text') { const el: Txt = { id: uid(), type: 'text', x: p.x, y: p.y, color, text: 'Text', size: 18 }; setElements((els) => [...els, el]); setSelectedIds([el.id]); setEditingId(el.id); return; }
    if (tool === 'pen') { const el: Path = { id: uid(), type: 'path', points: [[p.x, p.y]], color, width: 2.5 }; setElements((els) => [...els, el]); opRef.current = { kind: 'draw', id: el.id }; return; }
    const el: Box = { id: uid(), type: tool as 'rect' | 'ellipse', x: p.x, y: p.y, w: 1, h: 1, color }; setElements((els) => [...els, el]); setSelectedIds([el.id]); opRef.current = { kind: 'resize', id: el.id, sx: p.x, sy: p.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const op = opRef.current; if (!op) return;
    if (op.kind === 'pan') { setOffset({ x: op.ox + (e.clientX - op.sx), y: op.oy + (e.clientY - op.sy) }); return; }
    const p = pt(e);
    if (op.kind === 'marquee') { setMarquee({ x: Math.min(op.sx, p.x), y: Math.min(op.sy, p.y), w: Math.abs(p.x - op.sx), h: Math.abs(p.y - op.sy) }); }
    else if (op.kind === 'draw') setElements((els) => els.map((el) => el.id === op.id && el.type === 'path' ? { ...el, points: [...el.points, [p.x, p.y]] } : el));
    else if (op.kind === 'resize') patch(op.id, { x: Math.min(op.sx, p.x), y: Math.min(op.sy, p.y), w: Math.abs(p.x - op.sx), h: Math.abs(p.y - op.sy) } as any);
    else if (op.kind === 'move') { const dx = p.x - op.sx, dy = p.y - op.sy; setElements((els) => els.map((el) => op.orig[el.id] ? translateEl(op.orig[el.id], dx, dy) : el)); }
    else if (op.kind === 'handle') {
      const minS = 12; let { x, y, w, h } = op;
      if (op.corner.includes('e')) w = Math.max(minS, p.x - op.x);
      if (op.corner.includes('s')) h = Math.max(minS, p.y - op.y);
      if (op.corner.includes('w')) { const nx = Math.min(p.x, op.x + op.w - minS); w = op.x + op.w - nx; x = nx; }
      if (op.corner.includes('n')) { const ny = Math.min(p.y, op.y + op.h - minS); h = op.y + op.h - ny; y = ny; }
      patch(op.id, { x, y, w, h } as any);
    }
  };

  const endOp = () => {
    const op = opRef.current;
    if (op?.kind === 'marquee') {
      const m = marquee;
      if (m && (m.w > 4 || m.h > 4)) {
        const hit = elsRef.current.filter((el) => intersects(bboxOf(el), m)).map((e) => e.id);
        setSelectedIds((prev) => Array.from(new Set([...(opRef.current?.shift ? prev : []), ...hit])));
      }
      setMarquee(null); opRef.current = null; return;
    }
    if (op) {
      if (op.kind === 'resize') { const el = elsRef.current.find((e) => e.id === op.id) as Box | undefined; if (el && el.w < 4 && el.h < 4) { setElements((els) => els.filter((e) => e.id !== op.id)); opRef.current = null; return; } }
      if (op.kind === 'move') { for (const id of Object.keys(op.orig)) emitUpsert(id); }
      else if (['draw', 'resize', 'handle'].includes(op.kind)) emitUpsert(op.id);
    }
    opRef.current = null;
  };

  const onElPointerDown = (e: React.PointerEvent, el: El) => {
    if (!canEdit || editingId) return;
    if (tool === 'eraser') { e.stopPropagation(); pushHistory(); emitOp({ kind: 'delete', id: el.id }); setElements((els) => els.filter((x) => x.id !== el.id)); return; }
    if (tool !== 'select') return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    let ids = selRef.current;
    if (e.shiftKey) ids = ids.includes(el.id) ? ids.filter((i) => i !== el.id) : [...ids, el.id];
    else if (!ids.includes(el.id)) ids = [el.id];
    setSelectedIds(ids);
    if (el.locked) return;
    const movable = ids.filter((id) => !elsRef.current.find((x) => x.id === id)?.locked);
    if (movable.length === 0) return;
    pushHistory();
    const p = pt(e);
    const orig: Record<string, El> = {};
    for (const id of movable) { const x = elsRef.current.find((q) => q.id === id); if (x) orig[id] = clone(x); }
    opRef.current = { kind: 'move', sx: p.x, sy: p.y, orig };
  };

  const onHandleDown = (e: React.PointerEvent, el: Box, corner: string) => { e.stopPropagation(); (e.target as Element).setPointerCapture?.(e.pointerId); pushHistory(); opRef.current = { kind: 'handle', id: el.id, corner, x: el.x, y: el.y, w: el.w, h: el.h }; };
  const commitText = (id: string, text: string) => { patch(id, { text } as any); setEditingId(null); setTimeout(() => emitUpsert(id), 0); };

  // ── Selection actions ──────────────────────────────────────────────────────
  const deleteSelected = () => { if (!selectedIds.length || !canEdit) return; pushHistory(); for (const id of selectedIds) emitOp({ kind: 'delete', id }); setElements((els) => els.filter((el) => !selectedIds.includes(el.id))); setSelectedIds([]); setCtxMenu(null); };
  const duplicateSelected = () => {
    if (!selectedIds.length || !canEdit) return; pushHistory();
    const copies = elsRef.current.filter((e) => selectedIds.includes(e.id)).map((e) => ({ ...translateEl(clone(e), 16, 16), id: uid() }));
    setElements((els) => [...els, ...copies]); setSelectedIds(copies.map((c) => c.id)); setCtxMenu(null);
    setTimeout(() => copies.forEach((c) => emitOp({ kind: 'upsert', el: c })), 0);
  };
  const reorder = (toFront: boolean) => {
    if (!selectedIds.length || !canEdit) return; pushHistory();
    const sel = elsRef.current.filter((e) => selectedIds.includes(e.id));
    const rest = elsRef.current.filter((e) => !selectedIds.includes(e.id));
    const next = toFront ? [...rest, ...sel] : [...sel, ...rest];
    setElements(next); setCtxMenu(null); setTimeout(() => emitOp({ kind: 'order', ids: next.map((e) => e.id) }), 0);
  };
  const toggleLock = () => {
    if (!selectedIds.length || !canEdit) return; pushHistory();
    const anyUnlocked = elsRef.current.some((e) => selectedIds.includes(e.id) && !e.locked);
    setElements((els) => els.map((el) => selectedIds.includes(el.id) ? ({ ...el, locked: anyUnlocked } as El) : el));
    setCtxMenu(null); setTimeout(() => selectedIds.forEach((id) => emitUpsert(id)), 0);
  };
  const recolor = (c: string) => { setColor(c); if (selectedIds.length && canEdit) { pushHistory(); setElements((els) => els.map((el) => selectedIds.includes(el.id) ? ({ ...el, color: c } as El) : el)); setTimeout(() => selectedIds.forEach((id) => emitUpsert(id)), 0); } };
  const clearAll = async () => { if (!elements.length || !canEdit) return; const ok = await showConfirm({ title: 'Clear the whiteboard?', message: 'This removes every element for the whole team.', confirmLabel: 'Clear', variant: 'danger' }); if (ok) { pushHistory(); emitOp({ kind: 'clear' }); setElements([]); setSelectedIds([]); } };
  const nudge = (dx: number, dy: number) => { if (!selectedIds.length || !canEdit) return; setElements((els) => els.map((el) => selectedIds.includes(el.id) && !el.locked ? translateEl(el, dx, dy) : el)); setTimeout(() => selectedIds.forEach((id) => emitUpsert(id)), 0); };

  // ── Keyboard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editingId || !canEdit) return;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (meta && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if (meta && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSelected(); return; }
      if (meta && e.key.toLowerCase() === 'c') { clipRef.current = clone(elsRef.current.filter((x) => selRef.current.includes(x.id))); return; }
      if (meta && e.key.toLowerCase() === 'v') {
        if (!clipRef.current.length) return; e.preventDefault(); pushHistory();
        const copies = clipRef.current.map((e2) => ({ ...translateEl(clone(e2), 24, 24), id: uid() }));
        setElements((els) => [...els, ...copies]); setSelectedIds(copies.map((c) => c.id)); setTimeout(() => copies.forEach((c) => emitOp({ kind: 'upsert', el: c })), 0); return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selRef.current.length) { e.preventDefault(); deleteSelected(); return; }
      const step = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowUp') { e.preventDefault(); if (!e.repeat) pushHistory(); nudge(0, -step); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); if (!e.repeat) pushHistory(); nudge(0, step); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); if (!e.repeat) pushHistory(); nudge(-step, 0); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); if (!e.repeat) pushHistory(); nudge(step, 0); }
      else if (e.key === 'Escape') { setSelectedIds([]); setCtxMenu(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editingId, canEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!ctxMenu) return; const close = () => setCtxMenu(null); window.addEventListener('click', close); return () => window.removeEventListener('click', close); }, [ctxMenu]);

  if (!activeTeam) return <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center text-sm text-slate-500">Select a team to open the whiteboard.</div>;

  const cursor = tool === 'pan' ? 'grab' : tool === 'eraser' ? 'cell' : 'default';
  const HANDLES = ['nw', 'ne', 'sw', 'se'] as const;
  const handlePos = (b: Box, c: string) => ({ x: c.includes('w') ? b.x : b.x + b.w, y: c.includes('n') ? b.y : b.y + b.h });
  const soleBox = selectedIds.length === 1 ? (elements.find((e) => e.id === selectedIds[0]) as Box | undefined) : undefined;

  const openCtx = (e: React.MouseEvent, el: El) => { if (!canEdit) return; e.preventDefault(); if (!selectedIds.includes(el.id)) setSelectedIds([el.id]); setCtxMenu({ x: e.clientX, y: e.clientY }); };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-slate-50 dark:bg-slate-950">
      {/* Toolbar */}
      <div className="z-10 flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white/80 px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200"><Presentation className="h-4 w-4 text-brand-500" /> Whiteboard</div>
        <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
        {TOOLS.filter((t) => canEdit || t.id === 'select' || t.id === 'pan').map((t) => (
          <button key={t.id} onClick={() => setTool(t.id)} title={t.label} className={cn('rounded-lg p-2 transition-colors', tool === t.id ? 'bg-brand-500 text-white' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800')}><t.icon className="h-4 w-4" /></button>
        ))}
        {canEdit && (
          <>
            <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
            <button onClick={undo} disabled={!undoRef.current.length} title="Undo (⌘Z)" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800"><Undo2 className="h-4 w-4" /></button>
            <button onClick={redo} disabled={!redoRef.current.length} title="Redo (⇧⌘Z)" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800"><Redo2 className="h-4 w-4" /></button>
            <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
            <div className="flex items-center gap-1">
              {COLORS.map((c) => (<button key={c} onClick={() => recolor(c)} className={cn('h-5 w-5 rounded-full ring-2 ring-offset-1 dark:ring-offset-slate-900', color === c ? 'ring-slate-400' : 'ring-transparent')} style={{ background: c }} title={c} />))}
            </div>
            <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
            <button onClick={deleteSelected} disabled={!selectedIds.length} title="Delete selected" className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-500 disabled:opacity-40 dark:hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
            <button onClick={clearAll} title="Clear all" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"><Eraser className="h-4 w-4" /></button>
          </>
        )}
        <div className="ml-auto flex items-center gap-3 text-xs text-slate-400">
          {selectedIds.length > 1 && <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">{selectedIds.length} selected</span>}
          {!canEdit && <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-500 dark:bg-slate-800"><Eye className="h-3.5 w-3.5" /> View only</span>}
          {saving === 'saving' ? <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</span> : saving === 'saved' ? <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" /> Saved</span> : null}
        </div>
      </div>

      {/* Canvas */}
      <div className="relative flex-1 overflow-hidden">
        {loading && <div className="absolute inset-0 z-10 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>}
        <svg ref={svgRef} className="h-full w-full touch-none" style={{ cursor }} onPointerDown={onBgPointerDown} onPointerMove={onPointerMove} onPointerUp={endOp} onPointerLeave={endOp}>
          <defs><pattern id="wb-grid" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform={`translate(${offset.x % 24} ${offset.y % 24})`}><circle cx="1" cy="1" r="1" className="fill-slate-200 dark:fill-slate-800" /></pattern></defs>
          <rect width="100%" height="100%" fill="url(#wb-grid)" />
          <g transform={`translate(${offset.x} ${offset.y})`}>
            {elements.map((el) => {
              const selected = selectedIds.includes(el.id);
              const moveCursor = tool === 'select' && canEdit && !el.locked ? 'move' : tool === 'eraser' && canEdit ? 'cell' : cursor;
              if (el.type === 'path') {
                const b = el.points.length > 1 ? pathBounds(el.points) : null;
                return (<g key={el.id}>
                  <path d={pathD(el.points)} fill="none" stroke={el.color} strokeWidth={el.width} strokeLinecap="round" strokeLinejoin="round" onPointerDown={(e) => onElPointerDown(e, el)} onContextMenu={(e) => openCtx(e, el)} style={{ cursor: moveCursor }} />
                  {selected && b && <rect x={b.x - 4} y={b.y - 4} width={b.w + 8} height={b.h + 8} rx={6} fill="none" stroke="#e8502e" strokeWidth={1.5} strokeDasharray="4 3" pointerEvents="none" />}
                </g>);
              }
              if (el.type === 'text') {
                return editingId === el.id ? (
                  <foreignObject key={el.id} x={el.x} y={el.y - el.size} width={260} height={el.size + 16}><input autoFocus defaultValue={el.text} onBlur={(e) => commitText(el.id, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} className="w-full bg-transparent font-medium outline-none" style={{ color: el.color, fontSize: el.size }} /></foreignObject>
                ) : (
                  <text key={el.id} x={el.x} y={el.y} fill={el.color} fontSize={el.size} fontWeight={600} onPointerDown={(e) => onElPointerDown(e, el)} onDoubleClick={() => canEdit && !el.locked && setEditingId(el.id)} onContextMenu={(e) => openCtx(e, el)} className="select-none" style={{ cursor: moveCursor, textDecoration: selected ? 'underline' : undefined }}>{el.text}</text>
                );
              }
              const isNote = el.type === 'note';
              const common = { onPointerDown: (e: React.PointerEvent) => onElPointerDown(e, el), onDoubleClick: () => isNote && canEdit && !el.locked && setEditingId(el.id), onContextMenu: (e: React.MouseEvent) => openCtx(e, el), style: { cursor: moveCursor } as React.CSSProperties };
              return (<g key={el.id}>
                {el.type === 'ellipse'
                  ? <ellipse {...common} cx={el.x + el.w / 2} cy={el.y + el.h / 2} rx={el.w / 2} ry={el.h / 2} fill={`${el.color}1f`} stroke={el.color} strokeWidth={2} />
                  : <rect {...common} x={el.x} y={el.y} width={el.w} height={el.h} rx={isNote ? 8 : 6} fill={isNote ? el.color : `${el.color}1f`} stroke={isNote ? '#00000018' : el.color} strokeWidth={isNote ? 1 : 2} />}
                {isNote && (editingId === el.id
                  ? <foreignObject x={el.x} y={el.y} width={el.w} height={el.h}><textarea autoFocus defaultValue={el.text} onBlur={(e) => commitText(el.id, e.target.value)} className="h-full w-full resize-none bg-transparent p-2 text-sm text-slate-800 outline-none" placeholder="Type…" /></foreignObject>
                  : <foreignObject x={el.x} y={el.y} width={el.w} height={el.h} style={{ pointerEvents: 'none' }}><div className="h-full w-full overflow-hidden whitespace-pre-wrap p-2 text-sm text-slate-800">{el.text || ''}</div></foreignObject>)}
                {el.locked && <foreignObject x={el.x + el.w - 16} y={el.y + 2} width={14} height={14} style={{ pointerEvents: 'none' }}><Lock className="h-3 w-3 text-slate-400" /></foreignObject>}
                {selected && (<>
                  <rect x={el.x - 3} y={el.y - 3} width={el.w + 6} height={el.h + 6} rx={isNote ? 10 : 8} fill="none" stroke="#e8502e" strokeWidth={1.5} strokeDasharray="4 3" pointerEvents="none" />
                  {canEdit && tool === 'select' && !el.locked && soleBox?.id === el.id && HANDLES.map((c) => { const hp = handlePos(el, c); return <rect key={c} x={hp.x - 5} y={hp.y - 5} width={10} height={10} rx={2} fill="#fff" stroke="#e8502e" strokeWidth={1.5} onPointerDown={(e) => onHandleDown(e, el, c)} style={{ cursor: c === 'nw' || c === 'se' ? 'nwse-resize' : 'nesw-resize' }} />; })}
                </>)}
              </g>);
            })}
            {marquee && <rect x={marquee.x} y={marquee.y} width={marquee.w} height={marquee.h} fill="#e8502e10" stroke="#e8502e" strokeWidth={1} strokeDasharray="4 3" pointerEvents="none" />}
          </g>
        </svg>

        {elements.length === 0 && !loading && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <Presentation className="mb-3 h-10 w-10 text-slate-200 dark:text-slate-700" />
            <p className="text-sm font-medium text-slate-400">{canEdit ? 'Pick a tool and start sketching' : 'This whiteboard is empty'}</p>
            {canEdit && <p className="mt-1 text-xs text-slate-300 dark:text-slate-600">Drag to multi-select · ⌘Z undo · ⌘D duplicate · changes sync for your team</p>}
          </div>
        )}
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <div className="fixed z-50 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-800" style={{ left: ctxMenu.x, top: ctxMenu.y }} onClick={(e) => e.stopPropagation()}>
          {[
            { label: 'Duplicate', icon: Copy, fn: duplicateSelected },
            { label: 'Bring to front', icon: ArrowUpToLine, fn: () => reorder(true) },
            { label: 'Send to back', icon: ArrowDownToLine, fn: () => reorder(false) },
            { label: elements.some((e) => selectedIds.includes(e.id) && e.locked) ? 'Unlock' : 'Lock', icon: elements.some((e) => selectedIds.includes(e.id) && e.locked) ? Unlock : Lock, fn: toggleLock },
          ].map((it) => (
            <button key={it.label} onClick={it.fn} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"><it.icon className="h-3.5 w-3.5" /> {it.label}</button>
          ))}
          <div className="my-1 border-t border-slate-100 dark:border-slate-700/60" />
          <button onClick={deleteSelected} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
        </div>
      )}
    </div>
  );
};
