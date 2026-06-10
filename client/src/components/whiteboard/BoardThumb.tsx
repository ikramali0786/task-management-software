import { type BoardPreviewRect } from '@/services/whiteboardService';

/** Tiny SVG thumbnail rendered from a board's preview rects. */
export const BoardThumb = ({ preview, w = 132, h = 84 }: { preview: BoardPreviewRect[]; w?: number; h?: number }) => {
  if (!preview?.length) return <div className="flex items-center justify-center rounded-md bg-slate-50 text-[10px] text-slate-300 dark:bg-slate-800" style={{ width: w, height: h }}>empty</div>;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of preview) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x + p.w); maxY = Math.max(maxY, p.y + p.h); }
  const pad = 16; const bw = Math.max(maxX - minX + pad * 2, 1), bh = Math.max(maxY - minY + pad * 2, 1);
  const s = Math.min(w / bw, h / bh); const ox = (w - bw * s) / 2, oy = (h - bh * s) / 2;
  return (
    <svg width={w} height={h} className="rounded-md bg-slate-50 dark:bg-slate-800">
      {preview.map((p, i) => <rect key={i} x={ox + (p.x - minX + pad) * s} y={oy + (p.y - minY + pad) * s} width={Math.max(2, p.w * s)} height={Math.max(2, p.h * s)} rx={1} fill={p.c} fillOpacity={0.6} />)}
    </svg>
  );
};
