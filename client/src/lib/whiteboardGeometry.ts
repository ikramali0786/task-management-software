import { El, Shape, ImageEl, TaskEl } from './whiteboardTypes';

/** Pure constants + geometry/serialization helpers for the whiteboard. */

export const STROKES = ['#211e19', '#e8502e', '#f59e0b', '#22c55e', '#0ea5e9', '#8b5cf6'];
export const FILLS = ['none', '#ffffff', '#fde68a', '#fecaca', '#bbf7d0', '#bfdbfe', '#e9d5ff'];
export const NOTE_FILL = '#fde68a';
export const MIN_ZOOM = 0.1, MAX_ZOOM = 5;
export const PEER_TTL = 12000;
export const COARSE = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

export const uid = () => Math.random().toString(36).slice(2, 10);
export const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export const peerColor = (id: string) => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360; return `hsl(${h} 65% 45%)`; };

export const relTime = (iso: string) => {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now'; const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`; const d = Math.floor(h / 24);
  return d < 7 ? `${d}d ago` : new Date(iso).toLocaleDateString();
};

export const hexA = (hex: string, a: number) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex); if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

// Catmull-Rom → cubic bezier for smooth pen strokes.
export const smoothPathD = (pts: number[][]): string => {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]} ${pts[0][1]}` : '';
  if (pts.length === 2) return `M${pts[0][0]} ${pts[0][1]} L${pts[1][0]} ${pts[1][1]}`;
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
};

// Ramer–Douglas–Peucker point simplification to drop redundant points.
export const simplify = (pts: number[][], tol = 1.1): number[][] => {
  if (pts.length <= 2) return pts;
  const sqTol = tol * tol;
  const sqSegDist = (p: number[], a: number[], b: number[]) => {
    let x = a[0], y = a[1]; let dx = b[0] - x, dy = b[1] - y;
    if (dx || dy) { const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy); if (t > 1) { x = b[0]; y = b[1]; } else if (t > 0) { x += dx * t; y += dy * t; } }
    dx = p[0] - x; dy = p[1] - y; return dx * dx + dy * dy;
  };
  const out: number[][] = [pts[0]];
  const rdp = (first: number, last: number) => {
    let maxSq = sqTol, idx = -1;
    for (let i = first + 1; i < last; i++) { const sq = sqSegDist(pts[i], pts[first], pts[last]); if (sq > maxSq) { idx = i; maxSq = sq; } }
    if (idx !== -1) { if (idx - first > 1) rdp(first, idx); out.push(pts[idx]); if (last - idx > 1) rdp(idx, last); }
  };
  rdp(0, pts.length - 1); out.push(pts[pts.length - 1]);
  return out.map((q) => [Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10]);
};

export const pathBounds = (pts: number[][]) => {
  const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
};

export const isBoxLike = (el: El): el is Shape | ImageEl | TaskEl => 'w' in el && 'x' in el;
export const getBox = (el: El) => (isBoxLike(el) ? { x: el.x, y: el.y, w: el.w, h: el.h } : null);
export const intersects = (a: any, b: any) => !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
export const center = (b: { x: number; y: number; w: number; h: number }) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
export const edgePoint = (b: { x: number; y: number; w: number; h: number }, t: { x: number; y: number }) => {
  const c = center(b); const dx = t.x - c.x, dy = t.y - c.y;
  if (!dx && !dy) return c;
  const s = Math.min((b.w / 2) / (Math.abs(dx) || 1e-6), (b.h / 2) / (Math.abs(dy) || 1e-6));
  return { x: c.x + dx * s, y: c.y + dy * s };
};
export const polyDiamond = (b: any) => `${b.x + b.w / 2},${b.y} ${b.x + b.w},${b.y + b.h / 2} ${b.x + b.w / 2},${b.y + b.h} ${b.x},${b.y + b.h / 2}`;
export const polyTriangle = (b: any) => `${b.x + b.w / 2},${b.y} ${b.x + b.w},${b.y + b.h} ${b.x},${b.y + b.h}`;
export const polyStar = (b: any) => {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, R = Math.min(b.w, b.h) / 2, r = R * 0.42;
  return Array.from({ length: 10 }, (_, i) => {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5; const rad = i % 2 ? r : R;
    return `${cx + rad * Math.cos(ang) * (b.w / Math.min(b.w, b.h))},${cy + rad * Math.sin(ang) * (b.h / Math.min(b.w, b.h))}`;
  }).join(' ');
};
export const arrowHead = (p: { x: number; y: number }, ang: number, size = 9) => {
  const a1 = ang + Math.PI - 0.42, a2 = ang + Math.PI + 0.42;
  return `${p.x},${p.y} ${p.x + size * Math.cos(a1)},${p.y + size * Math.sin(a1)} ${p.x + size * Math.cos(a2)},${p.y + size * Math.sin(a2)}`;
};

export const sanitizeHtml = (html: string) => {
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
export const migrate = (el: any): El => {
  if (el.stroke !== undefined || el.fill !== undefined) return el as El;
  const c = el.color ?? '#211e19';
  if (el.type === 'note') return { ...el, fill: el.color ?? NOTE_FILL, stroke: '#00000018' };
  if (el.type === 'text') return { ...el, stroke: c, fill: 'none' };
  if (el.type === 'path') return { ...el, stroke: c, fill: 'none', strokeWidth: el.width ?? 2.5 };
  if (el.type === 'rect' || el.type === 'ellipse') return { ...el, stroke: c, fill: hexA(c, 0.12), strokeWidth: 2 };
  return el as El;
};
