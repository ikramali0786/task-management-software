import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Zap, Loader2, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { publicService, type PublicWhiteboardData } from '@/services/publicService';
import { boardToSVG } from '@/lib/whiteboardExport';

export const PublicWhiteboardPage = () => {
  const { token } = useParams();
  const [params] = useSearchParams();
  const embed = params.get('embed') === '1';
  const [data, setData] = useState<PublicWhiteboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    if (!token) return;
    publicService.getWhiteboard(token).then(setData).catch(() => setNotFound(true)).finally(() => setLoading(false));
  }, [token]);

  const board = useMemo(() => (data ? boardToSVG(data.elements, { background: 'transparent' }) : null), [data]);

  const fit = () => {
    const el = wrapRef.current; if (!el || !board) return;
    const cw = el.clientWidth, ch = el.clientHeight;
    const s = Math.min(cw / board.width, ch / board.height) * 0.92;
    setView({ scale: s, x: (cw - board.width * s) / 2, y: (ch - board.height * s) / 2 });
  };
  useEffect(() => { fit(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [board]);

  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault(); const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        const px = e.clientX - r.left, py = e.clientY - r.top;
        setView((v) => { const ns = Math.max(0.05, Math.min(8, v.scale * Math.exp(-e.deltaY * 0.01))); const cx = (px - v.x) / v.scale, cy = (py - v.y) / v.scale; return { scale: ns, x: px - cx * ns, y: py - cy * ns }; });
      } else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const zoom = (f: number) => { const el = wrapRef.current; if (!el) return; const px = el.clientWidth / 2, py = el.clientHeight / 2; setView((v) => { const ns = Math.max(0.05, Math.min(8, v.scale * f)); const cx = (px - v.x) / v.scale, cy = (py - v.y) / v.scale; return { scale: ns, x: px - cx * ns, y: py - cy * ns }; }); };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#faf8f4]"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  if (notFound || !data || !board) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf8f4] px-5 text-center">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Whiteboard unavailable</h1>
          <p className="mt-2 text-sm text-slate-500">This shared whiteboard doesn’t exist or has been turned off.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[#faf8f4]">
      {!embed && (
        <header className="border-b border-slate-200/70 bg-white/70 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg gradient-brand"><Zap className="h-4 w-4 text-white" /></span>
            <span className="text-sm font-semibold text-slate-700">{data.name}</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">{data.team} · Read-only</span>
            <span className="ml-auto text-xs text-slate-400">Powered by <Link to="/" className="font-medium text-brand-600 hover:underline">TaskFlow</Link></span>
          </div>
        </header>
      )}
      <div
        ref={wrapRef}
        className="relative flex-1 touch-none overflow-hidden"
        style={{ cursor: dragRef.current ? 'grabbing' : 'grab', backgroundImage: 'radial-gradient(#e2e8f0 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); dragRef.current = { x: e.clientX, y: e.clientY, ox: view.x, oy: view.y }; }}
        onPointerMove={(e) => { const d = dragRef.current; if (d) setView((v) => ({ ...v, x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) })); }}
        onPointerUp={() => { dragRef.current = null; }}
        onPointerLeave={() => { dragRef.current = null; }}
      >
        <div style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }} dangerouslySetInnerHTML={{ __html: board.svg }} />
        <div className="absolute bottom-4 right-4 flex items-center gap-0.5 rounded-xl border border-slate-200 bg-white/95 p-1 shadow-lg backdrop-blur">
          <button onClick={() => zoom(1 / 1.2)} title="Zoom out" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><ZoomOut className="h-4 w-4" /></button>
          <span className="w-11 text-center text-xs font-medium tabular-nums text-slate-600">{Math.round(view.scale * 100)}%</span>
          <button onClick={() => zoom(1.2)} title="Zoom in" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><ZoomIn className="h-4 w-4" /></button>
          <div className="mx-0.5 h-5 w-px bg-slate-200" />
          <button onClick={fit} title="Fit to screen" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><Maximize2 className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
};
