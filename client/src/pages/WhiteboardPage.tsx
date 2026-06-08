import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MousePointer2, Hand, StickyNote, Square, Circle, Pencil, Type, Trash2,
  Eraser, Loader2, Check, Presentation,
} from 'lucide-react';
import { useTeamStore } from '@/store/teamStore';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { getSocket } from '@/lib/socket';
import { whiteboardService } from '@/services/whiteboardService';
import { cn } from '@/lib/utils';

type Tool = 'select' | 'pan' | 'note' | 'rect' | 'ellipse' | 'pen' | 'text';
type El =
  | { id: string; type: 'note' | 'rect' | 'ellipse'; x: number; y: number; w: number; h: number; color: string; text?: string }
  | { id: string; type: 'text'; x: number; y: number; color: string; text: string; size: number }
  | { id: string; type: 'path'; points: number[][]; color: string; width: number };

const COLORS = ['#e8502e', '#f59e0b', '#22c55e', '#0ea5e9', '#8b5cf6', '#211e19'];
const NOTE_FILL = '#fde68a';
const uid = () => Math.random().toString(36).slice(2, 10);
const pathD = (pts: number[][]) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]} ${p[1]}`).join(' ');

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

  const [elements, setElements] = useState<El[]>([]);
  const [tool, setTool] = useState<Tool>('select');
  const [color, setColor] = useState(COLORS[0]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [loading, setLoading] = useState(true);

  const svgRef = useRef<SVGSVGElement>(null);
  const offsetRef = useRef(offset);
  offsetRef.current = offset;
  const opRef = useRef<any>(null);            // current pointer operation
  const loadedRef = useRef(false);            // skip autosave until first load done
  const skipNextSaveRef = useRef(false);      // skip autosave on remote-applied changes

  // ── Load + live reload ─────────────────────────────────────────────────────
  const load = useCallback(async (markRemote = false) => {
    if (!activeTeam) return;
    try {
      const data = await whiteboardService.get(activeTeam._id);
      if (markRemote) skipNextSaveRef.current = true;
      setElements(Array.isArray(data.elements) ? data.elements : []);
    } catch {
      /* ignore */
    } finally {
      loadedRef.current = true;
      setLoading(false);
    }
  }, [activeTeam?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadedRef.current = false; setLoading(true); load(); }, [activeTeam?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !activeTeam) return;
    const handler = (p: { teamId: string; updatedBy: string }) => {
      if (p.teamId !== activeTeam._id) return;
      if (p.updatedBy === user?._id) return;       // our own save
      if (opRef.current || editingId) return;       // don't clobber an active edit
      load(true);
    };
    socket.on('whiteboard:updated', handler);
    return () => { socket.off('whiteboard:updated', handler); };
  }, [activeTeam?._id, user?._id, editingId, load]);

  // ── Debounced autosave ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!loadedRef.current || !activeTeam) return;
    if (skipNextSaveRef.current) { skipNextSaveRef.current = false; return; }
    setSaving('saving');
    const h = setTimeout(async () => {
      try {
        await whiteboardService.save(activeTeam._id, elements);
        setSaving('saved');
        setTimeout(() => setSaving('idle'), 1200);
      } catch {
        setSaving('idle');
      }
    }, 700);
    return () => clearTimeout(h);
  }, [elements, activeTeam?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Coordinate helper ──────────────────────────────────────────────────────
  const pt = (e: React.PointerEvent | PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left - offsetRef.current.x, y: e.clientY - r.top - offsetRef.current.y };
  };

  const patch = (id: string, p: Partial<El>) =>
    setElements((els) => els.map((el) => (el.id === id ? ({ ...el, ...p } as El) : el)));

  // ── Pointer handlers on the canvas background ──────────────────────────────
  const onBgPointerDown = (e: React.PointerEvent) => {
    if (editingId) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = pt(e);

    if (tool === 'pan') {
      opRef.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y };
      return;
    }
    if (tool === 'select') { setSelectedId(null); return; }

    if (tool === 'note') {
      const el: El = { id: uid(), type: 'note', x: p.x, y: p.y, w: 168, h: 120, color: NOTE_FILL, text: '' };
      setElements((els) => [...els, el]); setSelectedId(el.id); setEditingId(el.id); return;
    }
    if (tool === 'text') {
      const el: El = { id: uid(), type: 'text', x: p.x, y: p.y, color, text: 'Text', size: 18 };
      setElements((els) => [...els, el]); setSelectedId(el.id); setEditingId(el.id); return;
    }
    if (tool === 'pen') {
      const el: El = { id: uid(), type: 'path', points: [[p.x, p.y]], color, width: 2.5 };
      setElements((els) => [...els, el]); opRef.current = { kind: 'draw', id: el.id }; return;
    }
    // rect / ellipse
    const el: El = { id: uid(), type: tool as 'rect' | 'ellipse', x: p.x, y: p.y, w: 1, h: 1, color };
    setElements((els) => [...els, el]); setSelectedId(el.id);
    opRef.current = { kind: 'resize', id: el.id, sx: p.x, sy: p.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const op = opRef.current;
    if (!op) return;
    if (op.kind === 'pan') { setOffset({ x: op.ox + (e.clientX - op.sx), y: op.oy + (e.clientY - op.sy) }); return; }
    const p = pt(e);
    if (op.kind === 'draw') {
      setElements((els) => els.map((el) => el.id === op.id && el.type === 'path' ? { ...el, points: [...el.points, [p.x, p.y]] } : el));
    } else if (op.kind === 'resize') {
      patch(op.id, { x: Math.min(op.sx, p.x), y: Math.min(op.sy, p.y), w: Math.abs(p.x - op.sx), h: Math.abs(p.y - op.sy) } as any);
    } else if (op.kind === 'move') {
      patch(op.id, { x: op.ex + (p.x - op.sx), y: op.ey + (p.y - op.sy) } as any);
    }
  };

  const endOp = () => {
    const op = opRef.current;
    if (op && (op.kind === 'resize')) {
      // Drop tiny accidental shapes.
      setElements((els) => els.filter((el) => !(el.id === op.id && (el as any).w < 4 && (el as any).h < 4)));
    }
    opRef.current = null;
  };

  // Element pointer-down (select + move)
  const onElPointerDown = (e: React.PointerEvent, el: El) => {
    if (tool !== 'select' || editingId) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setSelectedId(el.id);
    if (el.type === 'path') return; // paths aren't draggable in v1
    const p = pt(e);
    opRef.current = { kind: 'move', id: el.id, sx: p.x, sy: p.y, ex: (el as any).x, ey: (el as any).y };
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setElements((els) => els.filter((el) => el.id !== selectedId));
    setSelectedId(null);
  };

  const clearAll = async () => {
    if (elements.length === 0) return;
    const ok = await showConfirm({ title: 'Clear the whiteboard?', message: 'This removes every element for the whole team.', confirmLabel: 'Clear', variant: 'danger' });
    if (ok) { setElements([]); setSelectedId(null); }
  };

  // Keyboard: delete selected
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editingId) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) { e.preventDefault(); deleteSelected(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, editingId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!activeTeam) {
    return <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center text-sm text-slate-500">Select a team to open the whiteboard.</div>;
  }

  const cursor = tool === 'pan' ? 'grab' : tool === 'select' ? 'default' : 'crosshair';

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-slate-50 dark:bg-slate-950">
      {/* Toolbar */}
      <div className="z-10 flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white/80 px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <Presentation className="h-4 w-4 text-brand-500" /> Whiteboard
        </div>
        <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            title={t.label}
            className={cn('rounded-lg p-2 transition-colors', tool === t.id ? 'bg-brand-500 text-white' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800')}
          >
            <t.icon className="h-4 w-4" />
          </button>
        ))}
        <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
        <div className="flex items-center gap-1">
          {COLORS.map((c) => (
            <button key={c} onClick={() => { setColor(c); if (selectedId) patch(selectedId, { color: c } as any); }}
              className={cn('h-5 w-5 rounded-full ring-2 ring-offset-1 dark:ring-offset-slate-900', color === c ? 'ring-slate-400' : 'ring-transparent')}
              style={{ background: c }} title={c} />
          ))}
        </div>
        <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
        <button onClick={deleteSelected} disabled={!selectedId} title="Delete selected" className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-500 disabled:opacity-40 dark:hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
        <button onClick={clearAll} title="Clear all" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"><Eraser className="h-4 w-4" /></button>
        <div className="ml-auto flex items-center gap-1.5 text-xs text-slate-400">
          {saving === 'saving' ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</> : saving === 'saved' ? <><Check className="h-3.5 w-3.5 text-emerald-500" /> Saved</> : null}
        </div>
      </div>

      {/* Canvas */}
      <div className="relative flex-1 overflow-hidden">
        {loading && <div className="absolute inset-0 z-10 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>}
        <svg
          ref={svgRef}
          className="h-full w-full touch-none"
          style={{ cursor }}
          onPointerDown={onBgPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endOp}
          onPointerLeave={endOp}
        >
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
                return <path key={el.id} d={pathD(el.points)} fill="none" stroke={el.color} strokeWidth={el.width} strokeLinecap="round" strokeLinejoin="round" />;
              }
              if (el.type === 'text') {
                return editingId === el.id ? (
                  <foreignObject key={el.id} x={el.x} y={el.y - el.size} width={260} height={el.size + 16}>
                    <input
                      autoFocus defaultValue={el.text}
                      onBlur={(e) => { patch(el.id, { text: e.target.value } as any); setEditingId(null); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      className="w-full bg-transparent font-medium outline-none"
                      style={{ color: el.color, fontSize: el.size }}
                    />
                  </foreignObject>
                ) : (
                  <text key={el.id} x={el.x} y={el.y} fill={el.color} fontSize={el.size} fontWeight={600}
                    onPointerDown={(e) => onElPointerDown(e, el)} onDoubleClick={() => setEditingId(el.id)}
                    className="cursor-move select-none" style={selected ? { textDecoration: 'underline' } : undefined}>
                    {el.text}
                  </text>
                );
              }
              // note / rect / ellipse
              const isNote = el.type === 'note';
              const common = {
                onPointerDown: (e: React.PointerEvent) => onElPointerDown(e, el),
                onDoubleClick: () => isNote && setEditingId(el.id),
                style: { cursor: tool === 'select' ? 'move' : cursor } as React.CSSProperties,
              };
              return (
                <g key={el.id}>
                  {el.type === 'ellipse' ? (
                    <ellipse {...common} cx={el.x + el.w / 2} cy={el.y + el.h / 2} rx={el.w / 2} ry={el.h / 2}
                      fill={`${el.color}1f`} stroke={el.color} strokeWidth={2} />
                  ) : (
                    <rect {...common} x={el.x} y={el.y} width={el.w} height={el.h} rx={isNote ? 8 : 6}
                      fill={isNote ? el.color : `${el.color}1f`} stroke={isNote ? '#00000018' : el.color} strokeWidth={isNote ? 1 : 2} />
                  )}
                  {isNote && (editingId === el.id ? (
                    <foreignObject x={el.x} y={el.y} width={el.w} height={el.h}>
                      <textarea
                        autoFocus defaultValue={el.text}
                        onBlur={(e) => { patch(el.id, { text: e.target.value } as any); setEditingId(null); }}
                        className="h-full w-full resize-none bg-transparent p-2 text-sm text-slate-800 outline-none"
                        placeholder="Type…"
                      />
                    </foreignObject>
                  ) : (
                    <foreignObject x={el.x} y={el.y} width={el.w} height={el.h} style={{ pointerEvents: 'none' }}>
                      <div className="h-full w-full overflow-hidden whitespace-pre-wrap p-2 text-sm text-slate-800">{el.text || ''}</div>
                    </foreignObject>
                  ))}
                  {selected && (
                    <rect x={el.x - 3} y={el.y - 3} width={el.w + 6} height={el.h + 6} rx={isNote ? 10 : 8}
                      fill="none" stroke="#e8502e" strokeWidth={1.5} strokeDasharray="4 3" pointerEvents="none" />
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {elements.length === 0 && !loading && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <Presentation className="mb-3 h-10 w-10 text-slate-200 dark:text-slate-700" />
            <p className="text-sm font-medium text-slate-400">Pick a tool and start sketching</p>
            <p className="mt-1 text-xs text-slate-300 dark:text-slate-600">Sticky notes · shapes · pen · text — changes save automatically for your team</p>
          </div>
        )}
      </div>
    </div>
  );
};
