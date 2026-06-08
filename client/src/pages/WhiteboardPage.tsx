import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MousePointer2, Hand, StickyNote, Square, Circle, Pencil, Type, Trash2,
  Eraser, Loader2, Check, Presentation, Eye,
} from 'lucide-react';
import { useTeamStore } from '@/store/teamStore';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { usePermissions } from '@/hooks/usePermissions';
import { getSocket } from '@/lib/socket';
import { whiteboardService } from '@/services/whiteboardService';
import { cn } from '@/lib/utils';

type Tool = 'select' | 'pan' | 'note' | 'rect' | 'ellipse' | 'pen' | 'text';
type Box = { id: string; type: 'note' | 'rect' | 'ellipse'; x: number; y: number; w: number; h: number; color: string; text?: string };
type Txt = { id: string; type: 'text'; x: number; y: number; color: string; text: string; size: number };
type Path = { id: string; type: 'path'; points: number[][]; color: string; width: number };
type El = Box | Txt | Path;

const COLORS = ['#e8502e', '#f59e0b', '#22c55e', '#0ea5e9', '#8b5cf6', '#211e19'];
const NOTE_FILL = '#fde68a';
const uid = () => Math.random().toString(36).slice(2, 10);
const pathD = (pts: number[][]) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]} ${p[1]}`).join(' ');
const isBox = (el: El): el is Box => el.type === 'note' || el.type === 'rect' || el.type === 'ellipse';
const pathBounds = (pts: number[][]) => {
  const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
};

const TOOLS: { id: Tool; icon: React.ElementType; label: string }[] = [
  { id: 'select', icon: MousePointer2, label: 'Select' },
  { id: 'pan', icon: Hand, label: 'Pan' },
  { id: 'note', icon: StickyNote, label: 'Sticky note' },
  { id: 'rect', icon: Square, label: 'Rectangle' },
  { id: 'ellipse', icon: Circle, label: 'Ellipse' },
  { id: 'pen', icon: Pencil, label: 'Pen' },
  { id: 'text', icon: Type, label: 'Text' },
];

export const WhiteboardPage = () => {
  const { activeTeam } = useTeamStore();
  const { user } = useAuthStore();
  const { addToast, showConfirm } = useUIStore();
  const { can } = usePermissions();

  // Read-only members (viewers / guests) can view but not edit.
  const currentMember = activeTeam?.members.find((m: any) => (m.user?._id || m.user) === user?._id);
  const canEdit = can('commentOnTasks') && !currentMember?.isGuest;

  const [elements, setElements] = useState<El[]>([]);
  const [tool, setTool] = useState<Tool>('select');
  const [color, setColor] = useState(COLORS[0]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [loading, setLoading] = useState(true);

  const svgRef = useRef<SVGSVGElement>(null);
  const offsetRef = useRef(offset); offsetRef.current = offset;
  const elsRef = useRef(elements); elsRef.current = elements;
  const opRef = useRef<any>(null);
  const loadedRef = useRef(false);
  const skipSaveRef = useRef(false);
  const dirtyRef = useRef(false);

  // ── Live ops ───────────────────────────────────────────────────────────────
  const emitOp = (op: any) => {
    if (!activeTeam) return;
    getSocket()?.emit('whiteboard:op', { teamId: activeTeam._id, op });
  };
  const emitUpsert = (id: string) => {
    const el = elsRef.current.find((e) => e.id === id);
    if (el) emitOp({ kind: 'upsert', el });
  };

  // ── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeTeam) { setLoading(false); return; }
    let active = true;
    loadedRef.current = false; setLoading(true);
    whiteboardService.get(activeTeam._id)
      .then((d) => { if (active) setElements(Array.isArray(d.elements) ? d.elements : []); })
      .catch(() => {})
      .finally(() => { if (active) { loadedRef.current = true; setLoading(false); } });
    return () => { active = false; };
  }, [activeTeam?._id]);

  // ── Receive live ops from teammates ────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const apply = (op: any) => {
      skipSaveRef.current = true; // sender persists; receivers needn't write
      if (op.kind === 'upsert') {
        setElements((prev) => {
          const i = prev.findIndex((e) => e.id === op.el.id);
          if (i >= 0) { const c = [...prev]; c[i] = op.el; return c; }
          return [...prev, op.el];
        });
      } else if (op.kind === 'delete') {
        setElements((prev) => prev.filter((e) => e.id !== op.id));
      } else if (op.kind === 'clear') {
        setElements([]);
      }
    };
    socket.on('whiteboard:op', apply);
    return () => { socket.off('whiteboard:op', apply); };
  }, []);

  // ── Debounced autosave (editors only) ──────────────────────────────────────
  useEffect(() => {
    if (!loadedRef.current || !activeTeam || !canEdit) return;
    if (skipSaveRef.current) { skipSaveRef.current = false; return; }
    dirtyRef.current = true;
    setSaving('saving');
    const h = setTimeout(async () => {
      try {
        await whiteboardService.save(activeTeam._id, elsRef.current);
        dirtyRef.current = false;
        setSaving('saved'); setTimeout(() => setSaving('idle'), 1200);
      } catch { setSaving('idle'); }
    }, 700);
    return () => clearTimeout(h);
  }, [elements, activeTeam?._id, canEdit]);

  // Flush a pending save when leaving the page.
  useEffect(() => () => {
    if (dirtyRef.current && activeTeam && canEdit) {
      whiteboardService.save(activeTeam._id, elsRef.current).catch(() => {});
    }
  }, [activeTeam?._id, canEdit]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const pt = (e: React.PointerEvent | PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left - offsetRef.current.x, y: e.clientY - r.top - offsetRef.current.y };
  };
  const patch = (id: string, p: Partial<El>) => setElements((els) => els.map((el) => (el.id === id ? ({ ...el, ...p } as El) : el)));

  // ── Canvas pointer ─────────────────────────────────────────────────────────
  const onBgPointerDown = (e: React.PointerEvent) => {
    if (editingId) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = pt(e);

    if (tool === 'pan') { opRef.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y }; return; }
    if (!canEdit) { setSelectedId(null); return; }
    if (tool === 'select') { setSelectedId(null); return; }

    if (tool === 'note') {
      const el: Box = { id: uid(), type: 'note', x: p.x, y: p.y, w: 168, h: 120, color: NOTE_FILL, text: '' };
      setElements((els) => [...els, el]); setSelectedId(el.id); setEditingId(el.id); return;
    }
    if (tool === 'text') {
      const el: Txt = { id: uid(), type: 'text', x: p.x, y: p.y, color, text: 'Text', size: 18 };
      setElements((els) => [...els, el]); setSelectedId(el.id); setEditingId(el.id); return;
    }
    if (tool === 'pen') {
      const el: Path = { id: uid(), type: 'path', points: [[p.x, p.y]], color, width: 2.5 };
      setElements((els) => [...els, el]); opRef.current = { kind: 'draw', id: el.id }; return;
    }
    const el: Box = { id: uid(), type: tool as 'rect' | 'ellipse', x: p.x, y: p.y, w: 1, h: 1, color };
    setElements((els) => [...els, el]); setSelectedId(el.id);
    opRef.current = { kind: 'resize', id: el.id, sx: p.x, sy: p.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const op = opRef.current; if (!op) return;
    if (op.kind === 'pan') { setOffset({ x: op.ox + (e.clientX - op.sx), y: op.oy + (e.clientY - op.sy) }); return; }
    const p = pt(e);
    if (op.kind === 'draw') {
      setElements((els) => els.map((el) => el.id === op.id && el.type === 'path' ? { ...el, points: [...el.points, [p.x, p.y]] } : el));
    } else if (op.kind === 'resize') {
      patch(op.id, { x: Math.min(op.sx, p.x), y: Math.min(op.sy, p.y), w: Math.abs(p.x - op.sx), h: Math.abs(p.y - op.sy) } as any);
    } else if (op.kind === 'move') {
      patch(op.id, { x: op.ex + (p.x - op.sx), y: op.ey + (p.y - op.sy) } as any);
    } else if (op.kind === 'movePath') {
      const dx = p.x - op.sx, dy = p.y - op.sy;
      patch(op.id, { points: op.orig.map((pp: number[]) => [pp[0] + dx, pp[1] + dy]) } as any);
    } else if (op.kind === 'handle') {
      const minS = 12;
      let { x, y, w, h } = op;
      if (op.corner.includes('e')) w = Math.max(minS, p.x - op.x);
      if (op.corner.includes('s')) h = Math.max(minS, p.y - op.y);
      if (op.corner.includes('w')) { const nx = Math.min(p.x, op.x + op.w - minS); w = op.x + op.w - nx; x = nx; }
      if (op.corner.includes('n')) { const ny = Math.min(p.y, op.y + op.h - minS); h = op.y + op.h - ny; y = ny; }
      patch(op.id, { x, y, w, h } as any);
    }
  };

  const endOp = () => {
    const op = opRef.current;
    if (op) {
      if (op.kind === 'resize') {
        const el = elsRef.current.find((e) => e.id === op.id) as Box | undefined;
        if (el && el.w < 4 && el.h < 4) { setElements((els) => els.filter((e) => e.id !== op.id)); opRef.current = null; return; }
      }
      if (['draw', 'resize', 'move', 'movePath', 'handle'].includes(op.kind)) emitUpsert(op.id);
    }
    opRef.current = null;
  };

  const onElPointerDown = (e: React.PointerEvent, el: El) => {
    if (tool !== 'select' || editingId || !canEdit) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setSelectedId(el.id);
    const p = pt(e);
    if (el.type === 'path') opRef.current = { kind: 'movePath', id: el.id, sx: p.x, sy: p.y, orig: el.points.map((q) => [...q]) };
    else opRef.current = { kind: 'move', id: el.id, sx: p.x, sy: p.y, ex: (el as any).x, ey: (el as any).y };
  };

  const onHandleDown = (e: React.PointerEvent, el: Box, corner: string) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    opRef.current = { kind: 'handle', id: el.id, corner, x: el.x, y: el.y, w: el.w, h: el.h };
  };

  const commitText = (id: string, text: string) => { patch(id, { text } as any); setEditingId(null); setTimeout(() => emitUpsert(id), 0); };

  const deleteSelected = () => {
    if (!selectedId || !canEdit) return;
    emitOp({ kind: 'delete', id: selectedId });
    setElements((els) => els.filter((el) => el.id !== selectedId));
    setSelectedId(null);
  };
  const clearAll = async () => {
    if (elements.length === 0 || !canEdit) return;
    const ok = await showConfirm({ title: 'Clear the whiteboard?', message: 'This removes every element for the whole team.', confirmLabel: 'Clear', variant: 'danger' });
    if (ok) { emitOp({ kind: 'clear' }); setElements([]); setSelectedId(null); }
  };
  const recolor = (c: string) => {
    setColor(c);
    if (selectedId && canEdit) { patch(selectedId, { color: c } as any); setTimeout(() => emitUpsert(selectedId), 0); }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editingId || !canEdit) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) { e.preventDefault(); deleteSelected(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, editingId, canEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!activeTeam) return <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center text-sm text-slate-500">Select a team to open the whiteboard.</div>;

  const cursor = tool === 'pan' ? 'grab' : 'default';
  const HANDLES = ['nw', 'ne', 'sw', 'se'] as const;
  const handlePos = (b: Box, c: string) => ({ x: c.includes('w') ? b.x : b.x + b.w, y: c.includes('n') ? b.y : b.y + b.h });

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-slate-50 dark:bg-slate-950">
      {/* Toolbar */}
      <div className="z-10 flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white/80 px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <Presentation className="h-4 w-4 text-brand-500" /> Whiteboard
        </div>
        <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
        {TOOLS.filter((t) => canEdit || t.id === 'select' || t.id === 'pan').map((t) => (
          <button key={t.id} onClick={() => setTool(t.id)} title={t.label}
            className={cn('rounded-lg p-2 transition-colors', tool === t.id ? 'bg-brand-500 text-white' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800')}>
            <t.icon className="h-4 w-4" />
          </button>
        ))}
        {canEdit && (
          <>
            <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
            <div className="flex items-center gap-1">
              {COLORS.map((c) => (
                <button key={c} onClick={() => recolor(c)}
                  className={cn('h-5 w-5 rounded-full ring-2 ring-offset-1 dark:ring-offset-slate-900', color === c ? 'ring-slate-400' : 'ring-transparent')}
                  style={{ background: c }} title={c} />
              ))}
            </div>
            <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
            <button onClick={deleteSelected} disabled={!selectedId} title="Delete selected" className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-500 disabled:opacity-40 dark:hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
            <button onClick={clearAll} title="Clear all" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"><Eraser className="h-4 w-4" /></button>
          </>
        )}
        <div className="ml-auto flex items-center gap-3 text-xs text-slate-400">
          {!canEdit && <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-500 dark:bg-slate-800"><Eye className="h-3.5 w-3.5" /> View only</span>}
          {saving === 'saving' ? <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</span> : saving === 'saved' ? <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" /> Saved</span> : null}
        </div>
      </div>

      {/* Canvas */}
      <div className="relative flex-1 overflow-hidden">
        {loading && <div className="absolute inset-0 z-10 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>}
        <svg ref={svgRef} className="h-full w-full touch-none" style={{ cursor }}
          onPointerDown={onBgPointerDown} onPointerMove={onPointerMove} onPointerUp={endOp} onPointerLeave={endOp}>
          <defs>
            <pattern id="wb-grid" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform={`translate(${offset.x % 24} ${offset.y % 24})`}>
              <circle cx="1" cy="1" r="1" className="fill-slate-200 dark:fill-slate-800" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#wb-grid)" />

          <g transform={`translate(${offset.x} ${offset.y})`}>
            {elements.map((el) => {
              const selected = el.id === selectedId;
              if (el.type === 'path') {
                const b = el.points.length > 1 ? pathBounds(el.points) : null;
                return (
                  <g key={el.id}>
                    <path d={pathD(el.points)} fill="none" stroke={el.color} strokeWidth={el.width} strokeLinecap="round" strokeLinejoin="round"
                      onPointerDown={(e) => onElPointerDown(e, el)} style={{ cursor: tool === 'select' && canEdit ? 'move' : cursor }} />
                    {selected && b && <rect x={b.x - 4} y={b.y - 4} width={b.w + 8} height={b.h + 8} rx={6} fill="none" stroke="#e8502e" strokeWidth={1.5} strokeDasharray="4 3" pointerEvents="none" />}
                  </g>
                );
              }
              if (el.type === 'text') {
                return editingId === el.id ? (
                  <foreignObject key={el.id} x={el.x} y={el.y - el.size} width={260} height={el.size + 16}>
                    <input autoFocus defaultValue={el.text}
                      onBlur={(e) => commitText(el.id, e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      className="w-full bg-transparent font-medium outline-none" style={{ color: el.color, fontSize: el.size }} />
                  </foreignObject>
                ) : (
                  <text key={el.id} x={el.x} y={el.y} fill={el.color} fontSize={el.size} fontWeight={600}
                    onPointerDown={(e) => onElPointerDown(e, el)} onDoubleClick={() => canEdit && setEditingId(el.id)}
                    className="select-none" style={{ cursor: tool === 'select' && canEdit ? 'move' : cursor, textDecoration: selected ? 'underline' : undefined }}>
                    {el.text}
                  </text>
                );
              }
              const isNote = el.type === 'note';
              const common = {
                onPointerDown: (e: React.PointerEvent) => onElPointerDown(e, el),
                onDoubleClick: () => isNote && canEdit && setEditingId(el.id),
                style: { cursor: tool === 'select' && canEdit ? 'move' : cursor } as React.CSSProperties,
              };
              return (
                <g key={el.id}>
                  {el.type === 'ellipse' ? (
                    <ellipse {...common} cx={el.x + el.w / 2} cy={el.y + el.h / 2} rx={el.w / 2} ry={el.h / 2} fill={`${el.color}1f`} stroke={el.color} strokeWidth={2} />
                  ) : (
                    <rect {...common} x={el.x} y={el.y} width={el.w} height={el.h} rx={isNote ? 8 : 6} fill={isNote ? el.color : `${el.color}1f`} stroke={isNote ? '#00000018' : el.color} strokeWidth={isNote ? 1 : 2} />
                  )}
                  {isNote && (editingId === el.id ? (
                    <foreignObject x={el.x} y={el.y} width={el.w} height={el.h}>
                      <textarea autoFocus defaultValue={el.text} onBlur={(e) => commitText(el.id, e.target.value)}
                        className="h-full w-full resize-none bg-transparent p-2 text-sm text-slate-800 outline-none" placeholder="Type…" />
                    </foreignObject>
                  ) : (
                    <foreignObject x={el.x} y={el.y} width={el.w} height={el.h} style={{ pointerEvents: 'none' }}>
                      <div className="h-full w-full overflow-hidden whitespace-pre-wrap p-2 text-sm text-slate-800">{el.text || ''}</div>
                    </foreignObject>
                  ))}
                  {selected && (
                    <>
                      <rect x={el.x - 3} y={el.y - 3} width={el.w + 6} height={el.h + 6} rx={isNote ? 10 : 8} fill="none" stroke="#e8502e" strokeWidth={1.5} strokeDasharray="4 3" pointerEvents="none" />
                      {canEdit && tool === 'select' && HANDLES.map((c) => {
                        const hp = handlePos(el, c);
                        return <rect key={c} x={hp.x - 5} y={hp.y - 5} width={10} height={10} rx={2} fill="#fff" stroke="#e8502e" strokeWidth={1.5}
                          onPointerDown={(e) => onHandleDown(e, el, c)} style={{ cursor: c === 'nw' || c === 'se' ? 'nwse-resize' : 'nesw-resize' }} />;
                      })}
                    </>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {elements.length === 0 && !loading && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <Presentation className="mb-3 h-10 w-10 text-slate-200 dark:text-slate-700" />
            <p className="text-sm font-medium text-slate-400">{canEdit ? 'Pick a tool and start sketching' : 'This whiteboard is empty'}</p>
            {canEdit && <p className="mt-1 text-xs text-slate-300 dark:text-slate-600">Sticky notes · shapes · pen · text — changes save & sync for your team</p>}
          </div>
        )}
      </div>
    </div>
  );
};
