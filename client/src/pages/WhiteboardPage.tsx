import { useEffect, useRef, useState } from 'react';
import {
  MousePointer2, Hand, StickyNote, Square, Circle, Diamond, Triangle, Star,
  Minus, ArrowUpRight, Spline, Pencil, Type, Frame as FrameIcon, Image as ImageIcon,
  ListTodo, Eraser, Loader2, Check, Presentation, Eye, Undo2, Redo2, Trash2,
  Copy, ArrowUpToLine, ArrowDownToLine, Lock, Unlock, Bold, Italic, Underline,
  List, AlignLeft, AlignCenter, AlignRight, Plus, Search, X,
  ZoomIn, ZoomOut, Maximize2, Grid3x3, Map as MapIcon, LocateFixed,
} from 'lucide-react';
import { useTeamStore } from '@/store/teamStore';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { useTaskStore } from '@/store/taskStore';
import { usePermissions } from '@/hooks/usePermissions';
import { getSocket } from '@/lib/socket';
import { whiteboardService } from '@/services/whiteboardService';
import { TASK_STATUSES, PRIORITY_CONFIG } from '@/types';
import { cn } from '@/lib/utils';

type Tool =
  | 'select' | 'pan' | 'note' | 'rect' | 'ellipse' | 'diamond' | 'triangle' | 'star'
  | 'line' | 'arrow' | 'connector' | 'pen' | 'text' | 'frame' | 'eraser';
type Align = 'left' | 'center' | 'right';
type Style = { fill?: string; stroke?: string; strokeWidth?: number; dash?: boolean; opacity?: number };
type Base = { id: string; locked?: boolean } & Style;
type ShapeType = 'note' | 'rect' | 'ellipse' | 'diamond' | 'triangle' | 'star' | 'frame';
type Shape = Base & { type: ShapeType; x: number; y: number; w: number; h: number; text?: string; html?: string; fontSize?: number; align?: Align };
type Txt = Base & { type: 'text'; x: number; y: number; text: string; size: number; align?: Align };
type PathEl = Base & { type: 'path'; points: number[][]; width?: number };
type LineEl = Base & { type: 'line' | 'arrow'; x1: number; y1: number; x2: number; y2: number };
type ImageEl = Base & { type: 'image'; x: number; y: number; w: number; h: number; url: string };
type TaskEl = Base & { type: 'task'; x: number; y: number; w: number; h: number; taskId: string; title: string; identifier?: number; status: string; priority?: string };
type Connector = Base & { type: 'connector'; from: string; to: string; arrow?: boolean };
type El = Shape | Txt | PathEl | LineEl | ImageEl | TaskEl | Connector;

const STROKES = ['#211e19', '#e8502e', '#f59e0b', '#22c55e', '#0ea5e9', '#8b5cf6'];
const FILLS = ['none', '#ffffff', '#fde68a', '#fecaca', '#bbf7d0', '#bfdbfe', '#e9d5ff'];
const NOTE_FILL = '#fde68a';
const SHAPE_TYPES: ShapeType[] = ['note', 'rect', 'ellipse', 'diamond', 'triangle', 'star', 'frame'];
const uid = () => Math.random().toString(36).slice(2, 10);
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const MIN_ZOOM = 0.1, MAX_ZOOM = 5;
type GridMode = 'dots' | 'lines' | 'off';
type Peer = { name: string; x: number; y: number; ids: string[]; lastSeen: number };
const peerColor = (id: string) => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360; return `hsl(${h} 65% 45%)`; };
const PEER_TTL = 12000;
const hexA = (hex: string, a: number) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex); if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};
const pathD = (pts: number[][]) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]} ${p[1]}`).join(' ');
const pathBounds = (pts: number[][]) => {
  const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
};
const isBoxLike = (el: El): el is Shape | ImageEl | TaskEl => 'w' in el && 'x' in el;
const getBox = (el: El) => (isBoxLike(el) ? { x: el.x, y: el.y, w: el.w, h: el.h } : null);
const intersects = (a: any, b: any) => !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
const center = (b: { x: number; y: number; w: number; h: number }) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
const edgePoint = (b: { x: number; y: number; w: number; h: number }, t: { x: number; y: number }) => {
  const c = center(b); const dx = t.x - c.x, dy = t.y - c.y;
  if (!dx && !dy) return c;
  const s = Math.min((b.w / 2) / (Math.abs(dx) || 1e-6), (b.h / 2) / (Math.abs(dy) || 1e-6));
  return { x: c.x + dx * s, y: c.y + dy * s };
};
const polyDiamond = (b: any) => `${b.x + b.w / 2},${b.y} ${b.x + b.w},${b.y + b.h / 2} ${b.x + b.w / 2},${b.y + b.h} ${b.x},${b.y + b.h / 2}`;
const polyTriangle = (b: any) => `${b.x + b.w / 2},${b.y} ${b.x + b.w},${b.y + b.h} ${b.x},${b.y + b.h}`;
const polyStar = (b: any) => {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, R = Math.min(b.w, b.h) / 2, r = R * 0.42;
  return Array.from({ length: 10 }, (_, i) => {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5; const rad = i % 2 ? r : R;
    return `${cx + rad * Math.cos(ang) * (b.w / Math.min(b.w, b.h))},${cy + rad * Math.sin(ang) * (b.h / Math.min(b.w, b.h))}`;
  }).join(' ');
};
const arrowHead = (p: { x: number; y: number }, ang: number, size = 9) => {
  const a1 = ang + Math.PI - 0.42, a2 = ang + Math.PI + 0.42;
  return `${p.x},${p.y} ${p.x + size * Math.cos(a1)},${p.y + size * Math.sin(a1)} ${p.x + size * Math.cos(a2)},${p.y + size * Math.sin(a2)}`;
};
const sanitizeHtml = (html: string) => {
  const allowed = /^(B|STRONG|I|EM|U|UL|OL|LI|BR|DIV|SPAN|P)$/;
  const root = document.createElement('div'); root.innerHTML = html;
  const walk = (node: Element) => {
    Array.from(node.children).forEach((c) => {
      if (!allowed.test(c.tagName)) { const parent = c.parentNode!; while (c.firstChild) parent.insertBefore(c.firstChild, c); parent.removeChild(c); }
      else { Array.from(c.attributes).forEach((a) => c.removeAttribute(a.name)); walk(c); }
    });
  };
  walk(root);
  return root.innerHTML.slice(0, 4000);
};
// Bring legacy `color`-based elements up to the fill/stroke model.
const migrate = (el: any): El => {
  if (el.stroke !== undefined || el.fill !== undefined) return el as El;
  const c = el.color ?? '#211e19';
  if (el.type === 'note') return { ...el, fill: el.color ?? NOTE_FILL, stroke: '#00000018' };
  if (el.type === 'text') return { ...el, stroke: c, fill: 'none' };
  if (el.type === 'path') return { ...el, stroke: c, fill: 'none', strokeWidth: el.width ?? 2.5 };
  if (el.type === 'rect' || el.type === 'ellipse') return { ...el, stroke: c, fill: hexA(c, 0.12), strokeWidth: 2 };
  return el as El;
};

const TOOLS: { id: Tool; icon: React.ElementType; label: string }[] = [
  { id: 'select', icon: MousePointer2, label: 'Select' },
  { id: 'pan', icon: Hand, label: 'Pan' },
  { id: 'note', icon: StickyNote, label: 'Sticky note' },
  { id: 'rect', icon: Square, label: 'Rectangle' },
  { id: 'ellipse', icon: Circle, label: 'Ellipse' },
  { id: 'diamond', icon: Diamond, label: 'Diamond' },
  { id: 'triangle', icon: Triangle, label: 'Triangle' },
  { id: 'star', icon: Star, label: 'Star' },
  { id: 'line', icon: Minus, label: 'Line' },
  { id: 'arrow', icon: ArrowUpRight, label: 'Arrow' },
  { id: 'connector', icon: Spline, label: 'Connector (click two elements)' },
  { id: 'pen', icon: Pencil, label: 'Pen' },
  { id: 'text', icon: Type, label: 'Text' },
  { id: 'frame', icon: FrameIcon, label: 'Frame / section' },
  { id: 'eraser', icon: Eraser, label: 'Eraser' },
];

export const WhiteboardPage = () => {
  const { activeTeam } = useTeamStore();
  const { user } = useAuthStore();
  const { addToast, showConfirm } = useUIStore();
  const { tasks, fetchTasks } = useTaskStore();
  const { can } = usePermissions();

  const currentMember = activeTeam?.members.find((m: any) => (m.user?._id || m.user) === user?._id);
  const canEdit = can('commentOnTasks') && !currentMember?.isGuest;

  const [elements, setElements] = useState<El[]>([]);
  const [tool, setTool] = useState<Tool>('select');
  const [paint, setPaint] = useState<Required<Style>>({ fill: 'none', stroke: '#211e19', strokeWidth: 2, dash: false, opacity: 1 });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [grid, setGrid] = useState<GridMode>(() => (localStorage.getItem('wb-grid') as GridMode) || 'dots');
  const [showMinimap, setShowMinimap] = useState(() => localStorage.getItem('wb-minimap') !== '0');
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [peers, setPeers] = useState<Record<string, Peer>>({});
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [taskPicker, setTaskPicker] = useState(false);
  const [taskQuery, setTaskQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [loading, setLoading] = useState(true);

  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const offsetRef = useRef(offset); offsetRef.current = offset;
  const scaleRef = useRef(scale); scaleRef.current = scale;
  const spaceRef = useRef(false);
  const elsRef = useRef(elements); elsRef.current = elements;
  const selRef = useRef(selectedIds); selRef.current = selectedIds;
  const toolRef = useRef(tool); toolRef.current = tool;
  const paintRef = useRef(paint); paintRef.current = paint;
  const opRef = useRef<any>(null);
  const loadedRef = useRef(false);
  const skipSaveRef = useRef(false);
  const dirtyRef = useRef(false);
  const undoRef = useRef<El[][]>([]);
  const redoRef = useRef<El[][]>([]);
  const clipRef = useRef<El[]>([]);
  const cursorTickRef = useRef(0);
  const liveTickRef = useRef(0);

  // ── Live ops ───────────────────────────────────────────────────────────────
  const emitOp = (op: any) => { if (activeTeam) getSocket()?.emit('whiteboard:op', { teamId: activeTeam._id, op }); };
  const emitUpsert = (id: string) => { const el = elsRef.current.find((e) => e.id === id); if (el) emitOp({ kind: 'upsert', el }); };
  // Throttled broadcast of in-progress edits so teammates see drawing/moving live.
  const liveEmit = (ids: string[]) => { const now = Date.now(); if (now - liveTickRef.current < 55) return; liveTickRef.current = now; for (const id of ids) emitUpsert(id); };
  const broadcastDiff = (prev: El[], next: El[]) => {
    const pm = new Map(prev.map((e) => [e.id, JSON.stringify(e)]));
    const nm = new Map(next.map((e) => [e.id, e]));
    for (const e of next) if (pm.get(e.id) !== JSON.stringify(e)) emitOp({ kind: 'upsert', el: e });
    for (const e of prev) if (!nm.has(e.id)) emitOp({ kind: 'delete', id: e.id });
  };

  // ── History ────────────────────────────────────────────────────────────────
  const pushHistory = () => { undoRef.current.push(clone(elsRef.current)); if (undoRef.current.length > 80) undoRef.current.shift(); redoRef.current = []; };
  const undo = () => { if (!undoRef.current.length) return; const prev = elsRef.current; const r = undoRef.current.pop()!; redoRef.current.push(clone(prev)); setElements(r); setSelectedIds([]); broadcastDiff(prev, r); };
  const redo = () => { if (!redoRef.current.length) return; const prev = elsRef.current; const r = redoRef.current.pop()!; undoRef.current.push(clone(prev)); setElements(r); setSelectedIds([]); broadcastDiff(prev, r); };

  // ── Load + migrate ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeTeam) { setLoading(false); return; }
    let active = true; loadedRef.current = false; setLoading(true);
    fetchTasks(activeTeam._id).catch(() => {});
    whiteboardService.get(activeTeam._id)
      .then((d) => { if (active) setElements((Array.isArray(d.elements) ? d.elements : []).map(migrate)); })
      .catch(() => {})
      .finally(() => { if (active) { loadedRef.current = true; setLoading(false); } });
    return () => { active = false; };
  }, [activeTeam?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Receive live ops ───────────────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket(); if (!socket) return;
    const apply = (op: any) => {
      skipSaveRef.current = true;
      if (op.kind === 'upsert') setElements((prev) => { const i = prev.findIndex((e) => e.id === op.el.id); if (i >= 0) { const c = [...prev]; c[i] = op.el; return c; } return [...prev, op.el]; });
      else if (op.kind === 'delete') setElements((prev) => prev.filter((e) => e.id !== op.id && !(e.type === 'connector' && (e.from === op.id || e.to === op.id))));
      else if (op.kind === 'clear') setElements([]);
      else if (op.kind === 'order') setElements((prev) => { const m = new Map(prev.map((e) => [e.id, e])); const ordered = op.ids.map((id: string) => m.get(id)).filter(Boolean); for (const e of prev) if (!op.ids.includes(e.id)) ordered.push(e); return ordered as El[]; });
    };
    socket.on('whiteboard:op', apply);
    return () => { socket.off('whiteboard:op', apply); };
  }, []);

  // ── Autosave ───────────────────────────────────────────────────────────────
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
  const pt = (e: React.PointerEvent | PointerEvent) => { const r = svgRef.current!.getBoundingClientRect(); const z = scaleRef.current; return { x: (e.clientX - r.left - offsetRef.current.x) / z, y: (e.clientY - r.top - offsetRef.current.y) / z }; };
  const centerPt = () => { const r = svgRef.current?.getBoundingClientRect(); const z = scaleRef.current; return { x: ((r?.width ?? 800) / 2 - offsetRef.current.x) / z, y: ((r?.height ?? 600) / 2 - offsetRef.current.y) / z }; };
  // Zoom toward a screen anchor point, keeping the canvas point under it fixed.
  const zoomTo = (next: number, ax: number, ay: number) => {
    const r = svgRef.current?.getBoundingClientRect(); if (!r) return;
    const ns = clamp(next, MIN_ZOOM, MAX_ZOOM); const z = scaleRef.current; const o = offsetRef.current;
    const cx = (ax - o.x) / z, cy = (ay - o.y) / z;
    setOffset({ x: ax - cx * ns, y: ay - cy * ns }); setScale(ns);
  };
  const zoomBy = (factor: number) => { const r = svgRef.current?.getBoundingClientRect(); zoomTo(scaleRef.current * factor, (r?.width ?? 800) / 2, (r?.height ?? 600) / 2); };
  const resetView = () => { setScale(1); setOffset({ x: 0, y: 0 }); };
  const zoomToFit = () => {
    const r = svgRef.current?.getBoundingClientRect(); const els = elsRef.current;
    if (!r || !els.length) { resetView(); return; }
    const m = byId(); let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of els) { const b = elBBox(el, m); if (!b.w && !b.h && el.type === 'connector') continue; minX = Math.min(minX, b.x); minY = Math.min(minY, b.y); maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h); }
    if (!isFinite(minX)) { resetView(); return; }
    const pad = 80; const bw = maxX - minX + pad * 2, bh = maxY - minY + pad * 2;
    const s = clamp(Math.min(r.width / bw, r.height / bh), MIN_ZOOM, 2);
    setScale(s); setOffset({ x: r.width / 2 - (minX + (maxX - minX) / 2) * s, y: r.height / 2 - (minY + (maxY - minY) / 2) * s });
  };
  const cycleGrid = () => setGrid((g) => { const next: GridMode = g === 'dots' ? 'lines' : g === 'lines' ? 'off' : 'dots'; localStorage.setItem('wb-grid', next); return next; });
  const patch = (id: string, p: any) => setElements((els) => els.map((el) => (el.id === id ? ({ ...el, ...p } as El) : el)));
  const translateEl = (el: El, dx: number, dy: number): El => {
    if (el.type === 'path') return { ...el, points: el.points.map((q) => [q[0] + dx, q[1] + dy]) };
    if (el.type === 'line' || el.type === 'arrow') return { ...el, x1: el.x1 + dx, y1: el.y1 + dy, x2: el.x2 + dx, y2: el.y2 + dy };
    if (el.type === 'connector') return el;
    return { ...el, x: (el as any).x + dx, y: (el as any).y + dy } as El;
  };
  const byId = () => new Map(elsRef.current.map((e) => [e.id, e]));
  const elBBox = (el: El, map?: Map<string, El>): { x: number; y: number; w: number; h: number } => {
    const b = getBox(el); if (b) return b;
    if (el.type === 'text') return { x: el.x, y: el.y - el.size, w: Math.max(40, el.text.length * el.size * 0.6), h: el.size + 6 };
    if (el.type === 'path') return pathBounds(el.points);
    if (el.type === 'line' || el.type === 'arrow') return { x: Math.min(el.x1, el.x2), y: Math.min(el.y1, el.y2), w: Math.abs(el.x2 - el.x1), h: Math.abs(el.y2 - el.y1) };
    if (el.type === 'connector') {
      const m = map ?? byId(); const a = m.get(el.from); const bb = m.get(el.to);
      if (!a || !bb) return { x: 0, y: 0, w: 0, h: 0 };
      const ca = center(elBBox(a, m)), cb = center(elBBox(bb, m));
      return { x: Math.min(ca.x, cb.x), y: Math.min(ca.y, cb.y), w: Math.abs(cb.x - ca.x), h: Math.abs(cb.y - ca.y) };
    }
    return { x: 0, y: 0, w: 0, h: 0 };
  };
  const connEnds = (c: Connector, map: Map<string, El>) => {
    const a = map.get(c.from), b = map.get(c.to); if (!a || !b) return null;
    const ba = elBBox(a, map), bb = elBBox(b, map);
    return { s: edgePoint(ba, center(bb)), e: edgePoint(bb, center(ba)) };
  };

  // ── Canvas pointer ─────────────────────────────────────────────────────────
  const onBgPointerDown = (e: React.PointerEvent) => {
    if (editingId) return;
    setCtxMenu(null);
    if (spaceRef.current || tool === 'pan') { (e.target as Element).setPointerCapture?.(e.pointerId); opRef.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y }; return; }
    if (tool === 'connector') { setConnectFrom(null); return; }
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = pt(e);
    if (!canEdit) { setSelectedIds([]); return; }
    if (tool === 'select') { if (!e.shiftKey) setSelectedIds([]); opRef.current = { kind: 'marquee', sx: p.x, sy: p.y, shift: e.shiftKey }; setMarquee({ x: p.x, y: p.y, w: 0, h: 0 }); return; }
    if (tool === 'eraser') return;
    pushHistory();
    if (tool === 'note') { const el: Shape = { id: uid(), type: 'note', x: p.x, y: p.y, w: 168, h: 120, fill: NOTE_FILL, stroke: '#00000018', strokeWidth: 1, opacity: 1, fontSize: 14, align: 'left', html: '' }; setElements((els) => [...els, el]); setSelectedIds([el.id]); setEditingId(el.id); return; }
    if (tool === 'text') { const el: Txt = { id: uid(), type: 'text', x: p.x, y: p.y, text: 'Text', size: 18, align: 'left', stroke: paint.stroke, opacity: 1 }; setElements((els) => [...els, el]); setSelectedIds([el.id]); setEditingId(el.id); return; }
    if (tool === 'pen') { const el: PathEl = { id: uid(), type: 'path', points: [[p.x, p.y]], stroke: paint.stroke, strokeWidth: paint.strokeWidth, dash: paint.dash, opacity: paint.opacity }; setElements((els) => [...els, el]); opRef.current = { kind: 'draw', id: el.id }; return; }
    if (tool === 'line' || tool === 'arrow') { const el: LineEl = { id: uid(), type: tool, x1: p.x, y1: p.y, x2: p.x, y2: p.y, stroke: paint.stroke, strokeWidth: paint.strokeWidth, dash: paint.dash, opacity: paint.opacity }; setElements((els) => [...els, el]); setSelectedIds([el.id]); opRef.current = { kind: 'lineDraw', id: el.id }; return; }
    // shape (rect/ellipse/diamond/triangle/star/frame)
    const isFrame = tool === 'frame';
    const el: Shape = { id: uid(), type: tool as ShapeType, x: p.x, y: p.y, w: 1, h: 1, fill: isFrame ? hexA('#94a3b8', 0.06) : paint.fill, stroke: isFrame ? '#94a3b8' : paint.stroke, strokeWidth: isFrame ? 1.5 : paint.strokeWidth, dash: isFrame ? true : paint.dash, opacity: paint.opacity, fontSize: 14, align: 'center', text: isFrame ? 'Frame' : '' };
    setElements((els) => isFrame ? [el, ...els] : [...els, el]); setSelectedIds([el.id]); opRef.current = { kind: 'resize', id: el.id, sx: p.x, sy: p.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    // Broadcast our cursor (throttled) regardless of whether an op is active.
    if (activeTeam) { const now = Date.now(); if (now - cursorTickRef.current > 45) { cursorTickRef.current = now; const c = pt(e); getSocket()?.emit('whiteboard:cursor', { teamId: activeTeam._id, x: c.x, y: c.y }); } }
    const op = opRef.current; if (!op) return;
    if (op.kind === 'pan') { setOffset({ x: op.ox + (e.clientX - op.sx), y: op.oy + (e.clientY - op.sy) }); return; }
    const p = pt(e);
    if (op.kind === 'marquee') setMarquee({ x: Math.min(op.sx, p.x), y: Math.min(op.sy, p.y), w: Math.abs(p.x - op.sx), h: Math.abs(p.y - op.sy) });
    else if (op.kind === 'draw') { setElements((els) => els.map((el) => el.id === op.id && el.type === 'path' ? { ...el, points: [...el.points, [p.x, p.y]] } : el)); liveEmit([op.id]); }
    else if (op.kind === 'lineDraw') { patch(op.id, { x2: p.x, y2: p.y }); liveEmit([op.id]); }
    else if (op.kind === 'lineHandle') { patch(op.id, op.end === 1 ? { x1: p.x, y1: p.y } : { x2: p.x, y2: p.y }); liveEmit([op.id]); }
    else if (op.kind === 'resize') { patch(op.id, { x: Math.min(op.sx, p.x), y: Math.min(op.sy, p.y), w: Math.abs(p.x - op.sx), h: Math.abs(p.y - op.sy) }); liveEmit([op.id]); }
    else if (op.kind === 'move') { const dx = p.x - op.sx, dy = p.y - op.sy; setElements((els) => els.map((el) => op.orig[el.id] ? translateEl(op.orig[el.id], dx, dy) : el)); liveEmit(Object.keys(op.orig)); }
    else if (op.kind === 'handle') {
      const minS = 12; let { x, y, w, h } = op;
      if (op.corner.includes('e')) w = Math.max(minS, p.x - op.x);
      if (op.corner.includes('s')) h = Math.max(minS, p.y - op.y);
      if (op.corner.includes('w')) { const nx = Math.min(p.x, op.x + op.w - minS); w = op.x + op.w - nx; x = nx; }
      if (op.corner.includes('n')) { const ny = Math.min(p.y, op.y + op.h - minS); h = op.y + op.h - ny; y = ny; }
      patch(op.id, { x, y, w, h }); liveEmit([op.id]);
    }
  };

  const endOp = () => {
    const op = opRef.current;
    if (op?.kind === 'marquee') {
      const m = marquee;
      if (m && (m.w > 4 || m.h > 4)) { const map = byId(); const hit = elsRef.current.filter((el) => intersects(elBBox(el, map), m)).map((e) => e.id); setSelectedIds((prev) => Array.from(new Set([...(op.shift ? prev : []), ...hit]))); }
      setMarquee(null); opRef.current = null; return;
    }
    if (op) {
      if (op.kind === 'resize') { const el = elsRef.current.find((e) => e.id === op.id); const b = el && getBox(el); if (b && b.w < 4 && b.h < 4) { setElements((els) => els.filter((e) => e.id !== op.id)); opRef.current = null; return; } }
      if (op.kind === 'lineDraw') { const el = elsRef.current.find((e) => e.id === op.id) as LineEl | undefined; if (el && Math.abs(el.x2 - el.x1) < 4 && Math.abs(el.y2 - el.y1) < 4) { setElements((els) => els.filter((e) => e.id !== op.id)); opRef.current = null; return; } }
      if (op.kind === 'move') { for (const id of Object.keys(op.orig)) emitUpsert(id); }
      else if (['draw', 'resize', 'handle', 'lineDraw', 'lineHandle'].includes(op.kind)) emitUpsert(op.id);
    }
    opRef.current = null;
  };

  const onElPointerDown = (e: React.PointerEvent, el: El) => {
    if (spaceRef.current) return; // let the event bubble to the canvas for panning
    if (!canEdit || editingId) return;
    if (tool === 'eraser') { e.stopPropagation(); pushHistory(); emitOp({ kind: 'delete', id: el.id }); setElements((els) => els.filter((x) => x.id !== el.id && !(x.type === 'connector' && (x.from === el.id || x.to === el.id)))); return; }
    if (tool === 'connector') {
      e.stopPropagation();
      if (el.type === 'connector') return;
      if (!connectFrom) { setConnectFrom(el.id); addToast({ type: 'info', title: 'Pick target', message: 'Now click the element to connect to.' }); return; }
      if (connectFrom === el.id) { setConnectFrom(null); return; }
      pushHistory();
      const conn: Connector = { id: uid(), type: 'connector', from: connectFrom, to: el.id, arrow: true, stroke: paint.stroke, strokeWidth: 2, dash: false, opacity: 1 };
      setElements((els) => [...els, conn]); setConnectFrom(null); setSelectedIds([conn.id]); setTimeout(() => emitOp({ kind: 'upsert', el: conn }), 0);
      return;
    }
    if (tool !== 'select') return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    let ids = selRef.current;
    if (e.shiftKey) ids = ids.includes(el.id) ? ids.filter((i) => i !== el.id) : [...ids, el.id];
    else if (!ids.includes(el.id)) ids = [el.id];
    setSelectedIds(ids);
    if (el.locked || el.type === 'connector') return;
    // Build the movable set; frames drag their contained elements too.
    const map = byId();
    const moveSet = new Set(ids.filter((id) => { const x = map.get(id); return x && !x.locked && x.type !== 'connector'; }));
    for (const id of Array.from(moveSet)) {
      const f = map.get(id); if (f?.type === 'frame') { const fb = elBBox(f, map); for (const o of elsRef.current) { if (o.id === id || o.locked) continue; const c = center(elBBox(o, map)); if (c.x >= fb.x && c.x <= fb.x + fb.w && c.y >= fb.y && c.y <= fb.y + fb.h) moveSet.add(o.id); } }
    }
    if (!moveSet.size) return;
    pushHistory();
    const p = pt(e); const orig: Record<string, El> = {};
    for (const id of moveSet) { const x = map.get(id); if (x) orig[id] = clone(x); }
    opRef.current = { kind: 'move', sx: p.x, sy: p.y, orig };
  };

  const onHandleDown = (e: React.PointerEvent, el: El, corner: string) => { e.stopPropagation(); (e.target as Element).setPointerCapture?.(e.pointerId); const b = getBox(el)!; pushHistory(); opRef.current = { kind: 'handle', id: el.id, corner, x: b.x, y: b.y, w: b.w, h: b.h }; };
  const onLineHandleDown = (e: React.PointerEvent, el: LineEl, end: 1 | 2) => { e.stopPropagation(); (e.target as Element).setPointerCapture?.(e.pointerId); pushHistory(); opRef.current = { kind: 'lineHandle', id: el.id, end }; };
  const commitText = (id: string, text: string) => { patch(id, { text }); setEditingId(null); setTimeout(() => emitUpsert(id), 0); };
  const commitHtml = (id: string, html: string) => { patch(id, { html: sanitizeHtml(html) }); setEditingId(null); setTimeout(() => emitUpsert(id), 0); };

  // ── Selection actions ──────────────────────────────────────────────────────
  const deleteSelected = () => { if (!selectedIds.length || !canEdit) return; pushHistory(); const set = new Set(selectedIds); for (const id of selectedIds) emitOp({ kind: 'delete', id }); setElements((els) => els.filter((el) => !set.has(el.id) && !(el.type === 'connector' && (set.has(el.from) || set.has(el.to))))); setSelectedIds([]); setCtxMenu(null); };
  const duplicateSelected = () => { if (!selectedIds.length || !canEdit) return; pushHistory(); const copies = elsRef.current.filter((e) => selectedIds.includes(e.id) && e.type !== 'connector').map((e) => ({ ...translateEl(clone(e), 16, 16), id: uid() })); setElements((els) => [...els, ...copies]); setSelectedIds(copies.map((c) => c.id)); setCtxMenu(null); setTimeout(() => copies.forEach((c) => emitOp({ kind: 'upsert', el: c })), 0); };
  const reorder = (toFront: boolean) => { if (!selectedIds.length || !canEdit) return; pushHistory(); const sel = elsRef.current.filter((e) => selectedIds.includes(e.id)); const rest = elsRef.current.filter((e) => !selectedIds.includes(e.id)); const next = toFront ? [...rest, ...sel] : [...sel, ...rest]; setElements(next); setCtxMenu(null); setTimeout(() => emitOp({ kind: 'order', ids: next.map((e) => e.id) }), 0); };
  const toggleLock = () => { if (!selectedIds.length || !canEdit) return; pushHistory(); const anyUnlocked = elsRef.current.some((e) => selectedIds.includes(e.id) && !e.locked); setElements((els) => els.map((el) => selectedIds.includes(el.id) ? ({ ...el, locked: anyUnlocked } as El) : el)); setCtxMenu(null); setTimeout(() => selectedIds.forEach((id) => emitUpsert(id)), 0); };
  const nudge = (dx: number, dy: number) => { if (!selectedIds.length || !canEdit) return; const set = new Set(selectedIds); setElements((els) => els.map((el) => set.has(el.id) && !el.locked ? translateEl(el, dx, dy) : el)); setTimeout(() => selectedIds.forEach((id) => emitUpsert(id)), 0); };
  const clearAll = async () => { if (!elements.length || !canEdit) return; const ok = await showConfirm({ title: 'Clear the whiteboard?', message: 'This removes every element for the whole team.', confirmLabel: 'Clear', variant: 'danger' }); if (ok) { pushHistory(); emitOp({ kind: 'clear' }); setElements([]); setSelectedIds([]); } };

  // ── Style ──────────────────────────────────────────────────────────────────
  const applyStyle = (p: Partial<Style> & { fontSize?: number; align?: Align }) => {
    if (selectedIds.length && canEdit) { pushHistory(); const set = new Set(selectedIds); setElements((els) => els.map((el) => set.has(el.id) ? ({ ...el, ...p } as El) : el)); setTimeout(() => selectedIds.forEach((id) => emitUpsert(id)), 0); }
    setPaint((s) => ({ ...s, ...(p.fill !== undefined ? { fill: p.fill } : {}), ...(p.stroke !== undefined ? { stroke: p.stroke } : {}), ...(p.strokeWidth !== undefined ? { strokeWidth: p.strokeWidth } : {}), ...(p.dash !== undefined ? { dash: p.dash } : {}), ...(p.opacity !== undefined ? { opacity: p.opacity } : {}) }));
  };
  const exec = (cmd: string) => { document.execCommand(cmd, false); };

  // ── Image upload ───────────────────────────────────────────────────────────
  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file || !activeTeam || !canEdit) return;
    setUploading(true);
    try {
      const url = await whiteboardService.uploadImage(activeTeam._id, file);
      const dim = await new Promise<{ w: number; h: number }>((res) => { const im = new Image(); im.onload = () => res({ w: im.naturalWidth || 240, h: im.naturalHeight || 180 }); im.onerror = () => res({ w: 240, h: 180 }); im.src = url; });
      const s = Math.min(1, 320 / Math.max(dim.w, dim.h)); const w = dim.w * s, h = dim.h * s; const c = centerPt();
      pushHistory();
      const el: ImageEl = { id: uid(), type: 'image', x: c.x - w / 2, y: c.y - h / 2, w, h, url, opacity: 1 };
      setElements((els) => [...els, el]); setSelectedIds([el.id]); emitOp({ kind: 'upsert', el });
    } catch { addToast({ type: 'error', title: 'Upload failed', message: 'The image could not be uploaded.' }); }
    finally { setUploading(false); }
  };

  // ── Task card ──────────────────────────────────────────────────────────────
  const addTaskCard = (t: any) => {
    if (!canEdit) return; pushHistory(); const c = centerPt();
    const el: TaskEl = { id: uid(), type: 'task', x: c.x - 110, y: c.y - 42, w: 220, h: 84, taskId: t._id, title: t.title, identifier: t.identifier, status: t.status, priority: t.priority };
    setElements((els) => [...els, el]); setSelectedIds([el.id]); setTaskPicker(false); setTaskQuery(''); emitOp({ kind: 'upsert', el });
  };

  // ── Keyboard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editingId || !canEdit) return;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (meta && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if (meta && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSelected(); return; }
      if (meta && e.key.toLowerCase() === 'c') { clipRef.current = clone(elsRef.current.filter((x) => selRef.current.includes(x.id) && x.type !== 'connector')); return; }
      if (meta && e.key.toLowerCase() === 'v') { if (!clipRef.current.length) return; e.preventDefault(); pushHistory(); const copies = clipRef.current.map((e2) => ({ ...translateEl(clone(e2), 24, 24), id: uid() })); setElements((els) => [...els, ...copies]); setSelectedIds(copies.map((c) => c.id)); setTimeout(() => copies.forEach((c) => emitOp({ kind: 'upsert', el: c })), 0); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selRef.current.length) { e.preventDefault(); deleteSelected(); return; }
      const step = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowUp') { e.preventDefault(); if (!e.repeat) pushHistory(); nudge(0, -step); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); if (!e.repeat) pushHistory(); nudge(0, step); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); if (!e.repeat) pushHistory(); nudge(-step, 0); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); if (!e.repeat) pushHistory(); nudge(step, 0); }
      else if (e.key === 'Escape') { setSelectedIds([]); setCtxMenu(null); setConnectFrom(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editingId, canEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!ctxMenu) return; const close = () => setCtxMenu(null); window.addEventListener('click', close); return () => window.removeEventListener('click', close); }, [ctxMenu]);

  // ── Wheel zoom / scroll-pan (native, non-passive so we can preventDefault) ──
  useEffect(() => {
    const node = wrapRef.current; if (!node) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = svgRef.current?.getBoundingClientRect(); if (!r) return;
      if (e.ctrlKey || e.metaKey) { zoomTo(scaleRef.current * Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top); }
      else { setOffset((o) => ({ x: o.x - e.deltaX, y: o.y - e.deltaY })); }
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Hold-space to pan (works in view-only too) ─────────────────────────────
  useEffect(() => {
    const isTyping = () => { const a = document.activeElement; return !!editingId || (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || (a as HTMLElement).isContentEditable)); };
    const down = (e: KeyboardEvent) => { if (e.code === 'Space' && !isTyping()) { e.preventDefault(); if (!spaceRef.current) { spaceRef.current = true; setSpaceHeld(true); } } };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') { spaceRef.current = false; setSpaceHeld(false); } };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [editingId]);

  useEffect(() => { localStorage.setItem('wb-minimap', showMinimap ? '1' : '0'); }, [showMinimap]);

  // ── Live collaboration: receive cursors / selection / presence ─────────────
  useEffect(() => {
    const socket = getSocket(); if (!socket || !activeTeam) return;
    const onCursor = (d: { userId: string; name: string; x: number; y: number }) => setPeers((p) => ({ ...p, [d.userId]: { name: d.name, x: d.x, y: d.y, ids: p[d.userId]?.ids ?? [], lastSeen: Date.now() } }));
    const onSelection = (d: { userId: string; name: string; ids: string[] }) => setPeers((p) => ({ ...p, [d.userId]: { name: d.name, x: p[d.userId]?.x ?? 0, y: p[d.userId]?.y ?? 0, ids: d.ids, lastSeen: Date.now() } }));
    const onLeave = (d: { userId: string }) => setPeers((p) => { const n = { ...p }; delete n[d.userId]; return n; });
    socket.on('whiteboard:cursor', onCursor);
    socket.on('whiteboard:selection', onSelection);
    socket.on('whiteboard:leave', onLeave);
    const sweep = setInterval(() => setPeers((p) => { const now = Date.now(); let changed = false; const n: Record<string, Peer> = {}; for (const k in p) { if (now - p[k].lastSeen < PEER_TTL) n[k] = p[k]; else changed = true; } return changed ? n : p; }), 4000);
    return () => { socket.off('whiteboard:cursor', onCursor); socket.off('whiteboard:selection', onSelection); socket.off('whiteboard:leave', onLeave); clearInterval(sweep); socket.emit('whiteboard:leave', { teamId: activeTeam._id }); setPeers({}); };
  }, [activeTeam?._id]);

  // Broadcast our selection so teammates see what we have highlighted.
  useEffect(() => { if (activeTeam) getSocket()?.emit('whiteboard:selection', { teamId: activeTeam._id, ids: selectedIds }); }, [selectedIds, activeTeam?._id]);

  if (!activeTeam) return <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center text-sm text-slate-500">Select a team to open the whiteboard.</div>;

  const cursor = spaceHeld ? 'grab' : tool === 'pan' ? 'grab' : tool === 'eraser' ? 'cell' : tool === 'connector' ? 'crosshair' : 'default';
  const hz = 1 / scale; // keep handles/hit-targets a constant screen size across zoom
  const HANDLES = ['nw', 'ne', 'sw', 'se'] as const;
  const map = new Map(elements.map((e) => [e.id, e]));
  const selEls = elements.filter((e) => selectedIds.includes(e.id));
  const soleBox = selEls.length === 1 ? getBox(selEls[0]) : null;
  const soleEl = selEls.length === 1 ? selEls[0] : null;
  const textSel = selEls.find((e) => e.type === 'text' || e.type === 'note' || (isBoxLike(e) && e.type !== 'image' && e.type !== 'task'));
  const showStyle = canEdit && (selectedIds.some((id) => map.get(id)?.type !== 'connector') || ['note', 'rect', 'ellipse', 'diamond', 'triangle', 'star', 'frame', 'line', 'arrow', 'pen', 'text'].includes(tool));
  const filteredTasks = Object.values(tasks).filter((t) => (t.title + ' ' + (t.identifier ?? '')).toLowerCase().includes(taskQuery.toLowerCase())).slice(0, 40);
  const openCtx = (e: React.MouseEvent, el: El) => { if (!canEdit) return; e.preventDefault(); if (!selectedIds.includes(el.id)) setSelectedIds([el.id]); setCtxMenu({ x: e.clientX, y: e.clientY }); };
  const sw = (n: number | undefined) => n ?? 2;
  const dashOf = (el: El) => (el as any).dash ? '6 5' : undefined;

  const renderShape = (el: Shape, selected: boolean, moveCursor: string) => {
    const b = { x: el.x, y: el.y, w: el.w, h: el.h };
    const common: any = { onPointerDown: (e: React.PointerEvent) => onElPointerDown(e, el), onContextMenu: (e: React.MouseEvent) => openCtx(e, el), onDoubleClick: () => canEdit && !el.locked && el.type !== 'frame' && setEditingId(el.id), style: { cursor: moveCursor }, fill: el.fill || 'none', stroke: el.stroke, strokeWidth: sw(el.strokeWidth), strokeDasharray: dashOf(el) };
    let shapeNode: React.ReactNode;
    if (el.type === 'ellipse') shapeNode = <ellipse {...common} cx={b.x + b.w / 2} cy={b.y + b.h / 2} rx={b.w / 2} ry={b.h / 2} />;
    else if (el.type === 'diamond') shapeNode = <polygon {...common} points={polyDiamond(b)} />;
    else if (el.type === 'triangle') shapeNode = <polygon {...common} points={polyTriangle(b)} />;
    else if (el.type === 'star') shapeNode = <polygon {...common} points={polyStar(b)} />;
    else shapeNode = <rect {...common} x={b.x} y={b.y} width={b.w} height={b.h} rx={el.type === 'note' ? 8 : el.type === 'frame' ? 4 : 6} />;
    const editing = editingId === el.id;
    return (
      <g key={el.id} opacity={el.opacity ?? 1}>
        {shapeNode}
        {el.type === 'frame' && <text x={b.x + 8} y={b.y - 6} fontSize={12} fontWeight={600} fill="#64748b" className="select-none" style={{ pointerEvents: 'none' }}>{el.text || 'Frame'}</text>}
        {el.type === 'note' ? (
          editing ? (
            <foreignObject x={b.x} y={b.y} width={b.w} height={b.h}>
              <div contentEditable suppressContentEditableWarning autoFocus ref={(n) => { if (n && !n.dataset.init) { n.dataset.init = '1'; n.innerHTML = el.html || ''; n.focus(); } }}
                onBlur={(e) => commitHtml(el.id, e.currentTarget.innerHTML)}
                className="h-full w-full overflow-auto p-2 text-slate-800 outline-none"
                style={{ fontSize: el.fontSize ?? 14, textAlign: el.align ?? 'left' }} />
            </foreignObject>
          ) : (
            <foreignObject x={b.x} y={b.y} width={b.w} height={b.h} style={{ pointerEvents: 'none' }}>
              <div className="h-full w-full overflow-hidden p-2 text-slate-800 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-4 [&_ol]:pl-4" style={{ fontSize: el.fontSize ?? 14, textAlign: el.align ?? 'left' }} dangerouslySetInnerHTML={{ __html: el.html || '' }} />
            </foreignObject>
          )
        ) : el.type !== 'frame' && (editing ? (
          <foreignObject x={b.x} y={b.y} width={b.w} height={b.h}>
            <input autoFocus defaultValue={el.text} onBlur={(e) => commitText(el.id, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} className="h-full w-full bg-transparent text-center outline-none" style={{ fontSize: el.fontSize ?? 14, textAlign: el.align ?? 'center', color: el.stroke }} />
          </foreignObject>
        ) : el.text ? (
          <foreignObject x={b.x} y={b.y} width={b.w} height={b.h} style={{ pointerEvents: 'none' }}>
            <div className="flex h-full w-full items-center justify-center overflow-hidden px-1.5 font-medium" style={{ fontSize: el.fontSize ?? 14, textAlign: el.align ?? 'center', color: el.stroke }}>{el.text}</div>
          </foreignObject>
        ) : null)}
        {el.locked && <foreignObject x={b.x + b.w - 16} y={b.y + 2} width={14} height={14} style={{ pointerEvents: 'none' }}><Lock className="h-3 w-3 text-slate-400" /></foreignObject>}
        {selected && <rect x={b.x - 3 * hz} y={b.y - 3 * hz} width={b.w + 6 * hz} height={b.h + 6 * hz} rx={10 * hz} fill="none" stroke="#e8502e" strokeWidth={1.5 * hz} strokeDasharray={`${4 * hz} ${3 * hz}`} pointerEvents="none" />}
        {selected && canEdit && tool === 'select' && !el.locked && soleEl?.id === el.id && HANDLES.map((c) => { const hx = c.includes('w') ? b.x : b.x + b.w; const hy = c.includes('n') ? b.y : b.y + b.h; return <rect key={c} x={hx - 5 * hz} y={hy - 5 * hz} width={10 * hz} height={10 * hz} rx={2 * hz} fill="#fff" stroke="#e8502e" strokeWidth={1.5 * hz} onPointerDown={(e) => onHandleDown(e, el, c)} style={{ cursor: c === 'nw' || c === 'se' ? 'nwse-resize' : 'nesw-resize' }} />; })}
      </g>
    );
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-slate-50 dark:bg-slate-950">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
      {/* Toolbar */}
      <div className="z-10 flex flex-wrap items-center gap-1.5 border-b border-slate-200 bg-white/80 px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200"><Presentation className="h-4 w-4 text-brand-500" /> Whiteboard</div>
        <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
        {TOOLS.filter((t) => canEdit || t.id === 'select' || t.id === 'pan').map((t) => (
          <button key={t.id} onClick={() => { setTool(t.id); setConnectFrom(null); }} title={t.label} className={cn('rounded-lg p-2 transition-colors', tool === t.id ? 'bg-brand-500 text-white' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800')}><t.icon className="h-4 w-4" /></button>
        ))}
        {canEdit && (
          <>
            <button onClick={() => fileRef.current?.click()} title="Insert image" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}</button>
            <button onClick={() => setTaskPicker((v) => !v)} title="Drop a task card" className={cn('rounded-lg p-2 transition-colors', taskPicker ? 'bg-brand-500 text-white' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800')}><ListTodo className="h-4 w-4" /></button>
            <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
            <button onClick={undo} disabled={!undoRef.current.length} title="Undo (⌘Z)" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800"><Undo2 className="h-4 w-4" /></button>
            <button onClick={redo} disabled={!redoRef.current.length} title="Redo (⇧⌘Z)" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800"><Redo2 className="h-4 w-4" /></button>
            <button onClick={deleteSelected} disabled={!selectedIds.length} title="Delete selected" className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-500 disabled:opacity-40 dark:hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
            <button onClick={clearAll} title="Clear all" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"><Eraser className="h-4 w-4" /></button>
          </>
        )}
        <div className="ml-auto flex items-center gap-3 text-xs text-slate-400">
          {Object.keys(peers).length > 0 && (
            <div className="flex items-center -space-x-1.5" title={`${Object.keys(peers).length} here now`}>
              {Object.entries(peers).slice(0, 5).map(([k, pr]) => (
                <span key={k} title={pr.name} className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold text-white dark:border-slate-900" style={{ background: peerColor(k) }}>{(pr.name || '?').slice(0, 1).toUpperCase()}</span>
              ))}
              {Object.keys(peers).length > 5 && <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-slate-400 text-[10px] font-semibold text-white dark:border-slate-900">+{Object.keys(peers).length - 5}</span>}
            </div>
          )}
          {connectFrom && <span className="rounded-full bg-sky-50 px-2 py-0.5 font-medium text-sky-600 dark:bg-sky-500/10 dark:text-sky-400">Pick target…</span>}
          {selectedIds.length > 1 && <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">{selectedIds.length} selected</span>}
          {!canEdit && <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-500 dark:bg-slate-800"><Eye className="h-3.5 w-3.5" /> View only</span>}
          {saving === 'saving' ? <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</span> : saving === 'saved' ? <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" /> Saved</span> : null}
        </div>
      </div>

      {/* Canvas */}
      <div ref={wrapRef} className="relative flex-1 overflow-hidden">
        {loading && <div className="absolute inset-0 z-10 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>}
        <svg ref={svgRef} className="h-full w-full touch-none" style={{ cursor }} onPointerDown={onBgPointerDown} onPointerMove={onPointerMove} onPointerUp={endOp} onPointerLeave={endOp}>
          <defs>
            <pattern id="wb-dots" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform={`translate(${offset.x} ${offset.y}) scale(${scale})`}><circle cx="1" cy="1" r="1" className="fill-slate-200 dark:fill-slate-800" /></pattern>
            <pattern id="wb-lines" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform={`translate(${offset.x} ${offset.y}) scale(${scale})`}><path d="M24 0H0V24" fill="none" className="stroke-slate-200 dark:stroke-slate-800" strokeWidth={1} vectorEffect="non-scaling-stroke" /></pattern>
          </defs>
          {grid !== 'off' && <rect width="100%" height="100%" fill={`url(#wb-${grid})`} />}
          <g transform={`translate(${offset.x} ${offset.y}) scale(${scale})`}>
            {elements.map((el) => {
              const selected = selectedIds.includes(el.id);
              const moveCursor = tool === 'select' && canEdit && !el.locked ? 'move' : tool === 'eraser' && canEdit ? 'cell' : tool === 'connector' && canEdit ? 'crosshair' : cursor;
              if (el.type === 'connector') {
                const ends = connEnds(el, map); if (!ends) return null;
                const ang = Math.atan2(ends.e.y - ends.s.y, ends.e.x - ends.s.x);
                return (<g key={el.id} opacity={el.opacity ?? 1}>
                  <line x1={ends.s.x} y1={ends.s.y} x2={ends.e.x} y2={ends.e.y} stroke="transparent" strokeWidth={14 * hz} onPointerDown={(e) => onElPointerDown(e, el)} onContextMenu={(e) => openCtx(e, el)} style={{ cursor: moveCursor }} />
                  <line x1={ends.s.x} y1={ends.s.y} x2={ends.e.x} y2={ends.e.y} stroke={el.stroke} strokeWidth={sw(el.strokeWidth)} strokeDasharray={dashOf(el)} pointerEvents="none" />
                  {el.arrow !== false && <polygon points={arrowHead(ends.e, ang)} fill={el.stroke} pointerEvents="none" />}
                  {selected && <line x1={ends.s.x} y1={ends.s.y} x2={ends.e.x} y2={ends.e.y} stroke="#e8502e" strokeWidth={sw(el.strokeWidth) + 4} strokeOpacity={0.25} pointerEvents="none" />}
                </g>);
              }
              if (el.type === 'line' || el.type === 'arrow') {
                const ang = Math.atan2(el.y2 - el.y1, el.x2 - el.x1);
                return (<g key={el.id} opacity={el.opacity ?? 1}>
                  <line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} stroke="transparent" strokeWidth={14 * hz} onPointerDown={(e) => onElPointerDown(e, el)} onContextMenu={(e) => openCtx(e, el)} style={{ cursor: moveCursor }} />
                  <line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} stroke={el.stroke} strokeWidth={sw(el.strokeWidth)} strokeDasharray={dashOf(el)} strokeLinecap="round" pointerEvents="none" />
                  {el.type === 'arrow' && <polygon points={arrowHead({ x: el.x2, y: el.y2 }, ang)} fill={el.stroke} pointerEvents="none" />}
                  {el.locked && <foreignObject x={(el.x1 + el.x2) / 2 - 7} y={(el.y1 + el.y2) / 2 - 7} width={14} height={14} style={{ pointerEvents: 'none' }}><Lock className="h-3 w-3 text-slate-400" /></foreignObject>}
                  {selected && canEdit && tool === 'select' && !el.locked && ([1, 2] as const).map((end) => { const ex = end === 1 ? el.x1 : el.x2, ey = end === 1 ? el.y1 : el.y2; return <rect key={end} x={ex - 5 * hz} y={ey - 5 * hz} width={10 * hz} height={10 * hz} rx={2 * hz} fill="#fff" stroke="#e8502e" strokeWidth={1.5 * hz} onPointerDown={(e) => onLineHandleDown(e, el, end)} style={{ cursor: 'crosshair' }} />; })}
                </g>);
              }
              if (el.type === 'path') {
                const b = el.points.length > 1 ? pathBounds(el.points) : null;
                return (<g key={el.id} opacity={el.opacity ?? 1}>
                  <path d={pathD(el.points)} fill="none" stroke={el.stroke} strokeWidth={sw(el.strokeWidth)} strokeDasharray={dashOf(el)} strokeLinecap="round" strokeLinejoin="round" onPointerDown={(e) => onElPointerDown(e, el)} onContextMenu={(e) => openCtx(e, el)} style={{ cursor: moveCursor }} />
                  {selected && b && <rect x={b.x - 4} y={b.y - 4} width={b.w + 8} height={b.h + 8} rx={6} fill="none" stroke="#e8502e" strokeWidth={1.5} strokeDasharray="4 3" pointerEvents="none" />}
                </g>);
              }
              if (el.type === 'text') {
                return editingId === el.id ? (
                  <foreignObject key={el.id} x={el.x} y={el.y - el.size} width={280} height={el.size + 16}><input autoFocus defaultValue={el.text} onBlur={(e) => commitText(el.id, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} className="w-full bg-transparent font-medium outline-none" style={{ color: el.stroke, fontSize: el.size, textAlign: el.align ?? 'left' }} /></foreignObject>
                ) : (
                  <text key={el.id} x={el.x} y={el.y} fill={el.stroke} fontSize={el.size} fontWeight={600} opacity={el.opacity ?? 1} textAnchor={el.align === 'center' ? 'middle' : el.align === 'right' ? 'end' : 'start'} onPointerDown={(e) => onElPointerDown(e, el)} onDoubleClick={() => canEdit && !el.locked && setEditingId(el.id)} onContextMenu={(e) => openCtx(e, el)} className="select-none" style={{ cursor: moveCursor, textDecoration: selected ? 'underline' : undefined }}>{el.text}</text>
                );
              }
              if (el.type === 'image') {
                return (<g key={el.id} opacity={el.opacity ?? 1}>
                  <image href={el.url} x={el.x} y={el.y} width={el.w} height={el.h} preserveAspectRatio="xMidYMid slice" onPointerDown={(e) => onElPointerDown(e, el)} onContextMenu={(e) => openCtx(e, el)} style={{ cursor: moveCursor }} />
                  {el.locked && <foreignObject x={el.x + el.w - 16} y={el.y + 2} width={14} height={14} style={{ pointerEvents: 'none' }}><Lock className="h-3 w-3 text-white drop-shadow" /></foreignObject>}
                  {selected && <rect x={el.x - 3 * hz} y={el.y - 3 * hz} width={el.w + 6 * hz} height={el.h + 6 * hz} rx={6 * hz} fill="none" stroke="#e8502e" strokeWidth={1.5 * hz} strokeDasharray={`${4 * hz} ${3 * hz}`} pointerEvents="none" />}
                  {selected && canEdit && tool === 'select' && !el.locked && soleEl?.id === el.id && HANDLES.map((c) => { const hx = c.includes('w') ? el.x : el.x + el.w; const hy = c.includes('n') ? el.y : el.y + el.h; return <rect key={c} x={hx - 5 * hz} y={hy - 5 * hz} width={10 * hz} height={10 * hz} rx={2 * hz} fill="#fff" stroke="#e8502e" strokeWidth={1.5 * hz} onPointerDown={(e) => onHandleDown(e, el, c)} style={{ cursor: c === 'nw' || c === 'se' ? 'nwse-resize' : 'nesw-resize' }} />; })}
                </g>);
              }
              if (el.type === 'task') {
                const st = TASK_STATUSES.find((s) => s.id === (el.status as any));
                const pr = el.priority ? PRIORITY_CONFIG[el.priority as keyof typeof PRIORITY_CONFIG] : null;
                return (<g key={el.id} opacity={el.opacity ?? 1}>
                  <foreignObject x={el.x} y={el.y} width={el.w} height={el.h} onPointerDown={(e) => onElPointerDown(e, el)} onContextMenu={(e) => openCtx(e, el)} style={{ cursor: moveCursor }}>
                    <div className="flex h-full w-full flex-col gap-1 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                      <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
                        {pr && <span className="h-2 w-2 rounded-full" style={{ background: pr.color }} />}
                        {el.identifier != null && <span>#{el.identifier}</span>}
                        {st && <span className="ml-auto rounded-full px-1.5 py-0.5 text-white" style={{ background: st.color }}>{st.label}</span>}
                      </div>
                      <div className="line-clamp-2 text-xs font-semibold leading-snug text-slate-700 dark:text-slate-200">{el.title}</div>
                    </div>
                  </foreignObject>
                  {el.locked && <foreignObject x={el.x + el.w - 16} y={el.y + 2} width={14} height={14} style={{ pointerEvents: 'none' }}><Lock className="h-3 w-3 text-slate-400" /></foreignObject>}
                  {selected && <rect x={el.x - 3 * hz} y={el.y - 3 * hz} width={el.w + 6 * hz} height={el.h + 6 * hz} rx={14 * hz} fill="none" stroke="#e8502e" strokeWidth={1.5 * hz} strokeDasharray={`${4 * hz} ${3 * hz}`} pointerEvents="none" />}
                  {selected && canEdit && tool === 'select' && !el.locked && soleEl?.id === el.id && HANDLES.map((c) => { const hx = c.includes('w') ? el.x : el.x + el.w; const hy = c.includes('n') ? el.y : el.y + el.h; return <rect key={c} x={hx - 5 * hz} y={hy - 5 * hz} width={10 * hz} height={10 * hz} rx={2 * hz} fill="#fff" stroke="#e8502e" strokeWidth={1.5 * hz} onPointerDown={(e) => onHandleDown(e, el, c)} style={{ cursor: c === 'nw' || c === 'se' ? 'nwse-resize' : 'nesw-resize' }} />; })}
                </g>);
              }
              return renderShape(el as Shape, selected, moveCursor);
            })}
            {marquee && <rect x={marquee.x} y={marquee.y} width={marquee.w} height={marquee.h} fill="#e8502e10" stroke="#e8502e" strokeWidth={1} strokeDasharray="4 3" pointerEvents="none" />}
            {connectFrom && (() => { const f = map.get(connectFrom); if (!f) return null; const b = elBBox(f, map); return <rect x={b.x - 4} y={b.y - 4} width={b.w + 8} height={b.h + 8} rx={8} fill="none" stroke="#0ea5e9" strokeWidth={2} strokeDasharray="5 4" pointerEvents="none" />; })()}
            {/* Teammate selection highlights + live cursors */}
            {Object.entries(peers).map(([k, pr]) => {
              const col = peerColor(k);
              return (<g key={k} pointerEvents="none">
                {pr.ids.map((id) => { const el = map.get(id); if (!el) return null; const b = elBBox(el, map); return <rect key={id} x={b.x - 2 * hz} y={b.y - 2 * hz} width={b.w + 4 * hz} height={b.h + 4 * hz} rx={6 * hz} fill="none" stroke={col} strokeWidth={1.5 * hz} strokeDasharray={`${4 * hz} ${3 * hz}`} />; })}
                {(pr.x !== 0 || pr.y !== 0) && (
                  <g transform={`translate(${pr.x} ${pr.y}) scale(${hz})`}>
                    <path d="M0 0 L0 17 L4.6 12.6 L7.7 18.6 L10.2 17.4 L7.1 11.5 L13.4 11.5 Z" fill={col} stroke="#fff" strokeWidth={1} />
                    <g transform="translate(13 11)">
                      <rect rx={4} ry={4} height={17} width={(pr.name || '?').length * 6.4 + 12} fill={col} />
                      <text x={6} y={12.5} fill="#fff" fontSize={11} fontWeight={600}>{pr.name}</text>
                    </g>
                  </g>
                )}
              </g>);
            })}
          </g>
        </svg>

        {elements.length === 0 && !loading && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <Presentation className="mb-3 h-10 w-10 text-slate-200 dark:text-slate-700" />
            <p className="text-sm font-medium text-slate-400">{canEdit ? 'Pick a tool and start building your diagram' : 'This whiteboard is empty'}</p>
            {canEdit && <p className="mt-1 text-xs text-slate-300 dark:text-slate-600">Shapes · connectors · images · task cards — everything syncs for your team</p>}
          </div>
        )}

        {/* Style panel */}
        {showStyle && (
          <div className="absolute bottom-4 left-1/2 flex max-w-[94vw] -translate-x-1/2 flex-wrap items-center gap-x-3 gap-y-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Fill</span>
              {FILLS.map((c) => (<button key={c} onClick={() => applyStyle({ fill: c })} className={cn('h-5 w-5 rounded-md border ring-1 ring-offset-1 dark:ring-offset-slate-900', paint.fill === c ? 'ring-brand-400' : 'ring-transparent', c === 'none' && 'relative overflow-hidden')} style={{ background: c === 'none' ? '#fff' : c, borderColor: '#0000001a' }} title={c}>{c === 'none' && <span className="absolute left-1/2 top-0 h-7 w-px -translate-x-1/2 rotate-45 bg-red-400" />}</button>))}
            </div>
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Stroke</span>
              {STROKES.map((c) => (<button key={c} onClick={() => applyStyle({ stroke: c })} className={cn('h-5 w-5 rounded-full ring-2 ring-offset-1 dark:ring-offset-slate-900', paint.stroke === c ? 'ring-slate-400' : 'ring-transparent')} style={{ background: c }} title={c} />))}
            </div>
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
            <div className="flex items-center gap-1">
              {[1, 2, 4, 8].map((w) => (<button key={w} onClick={() => applyStyle({ strokeWidth: w })} className={cn('flex h-6 w-6 items-center justify-center rounded-md', paint.strokeWidth === w ? 'bg-brand-500' : 'hover:bg-slate-100 dark:hover:bg-slate-800')}><span className="rounded-full" style={{ width: Math.min(w + 2, 10), height: Math.min(w + 2, 10), background: paint.strokeWidth === w ? '#fff' : '#64748b' }} /></button>))}
              <button onClick={() => applyStyle({ dash: !paint.dash })} title="Dashed" className={cn('ml-0.5 flex h-6 items-center rounded-md px-2 text-xs', paint.dash ? 'bg-brand-500 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800')}>┄</button>
            </div>
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
            <div className="flex items-center gap-1.5" title="Opacity">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Opacity</span>
              <input type="range" min={10} max={100} value={Math.round((paint.opacity ?? 1) * 100)} onChange={(e) => applyStyle({ opacity: Number(e.target.value) / 100 })} className="h-1 w-20 accent-brand-500" />
            </div>
            {textSel && (
              <>
                <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
                <div className="flex items-center gap-1">
                  <button onMouseDown={(e) => { e.preventDefault(); editingId ? exec('bold') : null; }} onClick={() => !editingId && applyStyle({} as any)} title="Bold (while editing a note)" className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><Bold className="h-3.5 w-3.5" /></button>
                  <button onMouseDown={(e) => { e.preventDefault(); if (editingId) exec('italic'); }} title="Italic" className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><Italic className="h-3.5 w-3.5" /></button>
                  <button onMouseDown={(e) => { e.preventDefault(); if (editingId) exec('underline'); }} title="Underline" className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><Underline className="h-3.5 w-3.5" /></button>
                  <button onMouseDown={(e) => { e.preventDefault(); if (editingId) exec('insertUnorderedList'); }} title="Bullet list (notes)" className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><List className="h-3.5 w-3.5" /></button>
                </div>
                <div className="flex items-center gap-1">
                  {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([a, Ic]) => (<button key={a} onClick={() => applyStyle({ align: a })} title={`Align ${a}`} className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><Ic className="h-3.5 w-3.5" /></button>))}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => applyStyle({ fontSize: Math.max(8, (((textSel as any).fontSize ?? (textSel as any).size ?? 14) - 2)) })} className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><Minus className="h-3.5 w-3.5" /></button>
                  <span className="w-5 text-center text-xs text-slate-500">{(textSel as any).fontSize ?? (textSel as any).size ?? 14}</span>
                  <button onClick={() => { const cur = (textSel as any).fontSize ?? (textSel as any).size ?? 14; const set = new Set(selectedIds); pushHistory(); setElements((els) => els.map((el) => set.has(el.id) ? ({ ...el, ...(el.type === 'text' ? { size: cur + 2 } : { fontSize: cur + 2 }) } as El) : el)); setTimeout(() => selectedIds.forEach((id) => emitUpsert(id)), 0); }} className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><Plus className="h-3.5 w-3.5" /></button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Task picker */}
        {taskPicker && canEdit && (
          <div className="absolute right-4 top-4 z-20 flex max-h-[70vh] w-72 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-800">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Drop a task</span>
              <button onClick={() => setTaskPicker(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
            </div>
            <div className="relative border-b border-slate-100 px-3 py-2 dark:border-slate-800">
              <Search className="absolute left-5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input value={taskQuery} onChange={(e) => setTaskQuery(e.target.value)} placeholder="Search tasks…" className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-7 pr-2 text-sm outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800" />
            </div>
            <div className="flex-1 overflow-y-auto p-1.5">
              {filteredTasks.length === 0 ? <p className="px-2 py-6 text-center text-xs text-slate-400">No tasks found.</p> : filteredTasks.map((t) => {
                const st = TASK_STATUSES.find((s) => s.id === t.status);
                return (<button key={t._id} onClick={() => addTaskCard(t)} className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800">
                  {st && <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: st.color }} />}
                  <span className="min-w-0"><span className="text-[10px] text-slate-400">#{t.identifier}</span><span className="line-clamp-2 text-xs font-medium text-slate-700 dark:text-slate-200">{t.title}</span></span>
                </button>);
              })}
            </div>
          </div>
        )}
        {/* Minimap */}
        {showMinimap && !loading && elements.length > 0 && (() => {
          const r = svgRef.current?.getBoundingClientRect(); const vw = r?.width ?? 0, vh = r?.height ?? 0;
          const viewX = -offset.x / scale, viewY = -offset.y / scale, viewW = vw / scale, viewH = vh / scale;
          let minX = viewX, minY = viewY, maxX = viewX + viewW, maxY = viewY + viewH;
          for (const el of elements) { const b = elBBox(el, map); if (el.type === 'connector' && !b.w && !b.h) continue; minX = Math.min(minX, b.x); minY = Math.min(minY, b.y); maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h); }
          const pad = 40; minX -= pad; minY -= pad; maxX += pad; maxY += pad;
          const wW = Math.max(maxX - minX, 1), wH = Math.max(maxY - minY, 1);
          const MW = 168, MH = 120; const ms = Math.min(MW / wW, MH / wH);
          const cw = wW * ms, ch = wH * ms, ox = (MW - cw) / 2, oy = (MH - ch) / 2;
          const toM = (x: number, y: number) => ({ x: ox + (x - minX) * ms, y: oy + (y - minY) * ms });
          const recenter = (e: React.PointerEvent) => {
            const br = (e.currentTarget as SVGElement).getBoundingClientRect();
            const wx = minX + (e.clientX - br.left - ox) / ms, wy = minY + (e.clientY - br.top - oy) / ms;
            setOffset({ x: vw / 2 - wx * scale, y: vh / 2 - wy * scale });
          };
          const vp = toM(viewX, viewY);
          return (
            <div className="absolute bottom-16 right-4 overflow-hidden rounded-xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
              <svg width={MW} height={MH} className="touch-none" style={{ cursor: 'pointer' }} onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); recenter(e); }} onPointerMove={(e) => { if (e.buttons) recenter(e); }}>
                <rect width={MW} height={MH} className="fill-slate-50 dark:fill-slate-800/50" />
                {elements.map((el) => { if (el.type === 'connector') return null; const b = elBBox(el, map); const a = toM(b.x, b.y); const c = el.type === 'note' ? '#f59e0b' : el.type === 'task' ? '#0ea5e9' : el.type === 'image' ? '#22c55e' : '#94a3b8'; return <rect key={el.id} x={a.x} y={a.y} width={Math.max(2, b.w * ms)} height={Math.max(2, b.h * ms)} rx={1} fill={c} fillOpacity={0.55} />; })}
                <rect x={vp.x} y={vp.y} width={viewW * ms} height={viewH * ms} fill="#e8502e15" stroke="#e8502e" strokeWidth={1.5} rx={2} pointerEvents="none" />
              </svg>
            </div>
          );
        })()}

        {/* Zoom & view controls */}
        <div className="absolute bottom-4 right-4 flex items-center gap-0.5 rounded-xl border border-slate-200 bg-white/95 p-1 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
          <button onClick={() => zoomBy(1 / 1.2)} title="Zoom out" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"><ZoomOut className="h-4 w-4" /></button>
          <button onClick={resetView} title="Reset to 100%" className="w-12 rounded-lg px-1 py-1 text-center text-xs font-medium tabular-nums text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">{Math.round(scale * 100)}%</button>
          <button onClick={() => zoomBy(1.2)} title="Zoom in" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"><ZoomIn className="h-4 w-4" /></button>
          <div className="mx-0.5 h-5 w-px bg-slate-200 dark:bg-slate-700" />
          <button onClick={zoomToFit} title="Zoom to fit" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"><Maximize2 className="h-4 w-4" /></button>
          <button onClick={resetView} title="Center / reset view" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"><LocateFixed className="h-4 w-4" /></button>
          <button onClick={cycleGrid} title={`Grid: ${grid}`} className={cn('rounded-lg p-1.5', grid !== 'off' ? 'text-brand-500 hover:bg-slate-100 dark:hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800')}><Grid3x3 className="h-4 w-4" /></button>
          <button onClick={() => setShowMinimap((v) => !v)} title="Toggle minimap" className={cn('rounded-lg p-1.5', showMinimap ? 'text-brand-500 hover:bg-slate-100 dark:hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800')}><MapIcon className="h-4 w-4" /></button>
        </div>
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
