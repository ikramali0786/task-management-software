// Dependency-free whiteboard export: serialize elements to a clean, standalone
// SVG (pure primitives — no foreignObject — so it rasterizes reliably), then
// to PNG / PDF / clipboard. Mirrors the on-canvas look closely enough for a
// faithful export without pulling in jsPDF or html2canvas.
import { TASK_STATUSES, PRIORITY_CONFIG } from '@/types';

type E = Record<string, any>;
const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const num = (n: number) => Math.round(n * 100) / 100;

const pathBounds = (pts: number[][]) => { const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]); return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }; };
const center = (b: any) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
const edgePoint = (b: any, t: { x: number; y: number }) => { const c = center(b); const dx = t.x - c.x, dy = t.y - c.y; if (!dx && !dy) return c; const s = Math.min((b.w / 2) / (Math.abs(dx) || 1e-6), (b.h / 2) / (Math.abs(dy) || 1e-6)); return { x: c.x + dx * s, y: c.y + dy * s }; };
const smoothPathD = (pts: number[][]): string => {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]} ${pts[0][1]}` : '';
  if (pts.length === 2) return `M${pts[0][0]} ${pts[0][1]} L${pts[1][0]} ${pts[1][1]}`;
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += ` C${num(p1[0] + (p2[0] - p0[0]) / 6)} ${num(p1[1] + (p2[1] - p0[1]) / 6)} ${num(p2[0] - (p3[0] - p1[0]) / 6)} ${num(p2[1] - (p3[1] - p1[1]) / 6)} ${num(p2[0])} ${num(p2[1])}`;
  }
  return d;
};
const polyDiamond = (b: any) => `${b.x + b.w / 2},${b.y} ${b.x + b.w},${b.y + b.h / 2} ${b.x + b.w / 2},${b.y + b.h} ${b.x},${b.y + b.h / 2}`;
const polyTriangle = (b: any) => `${b.x + b.w / 2},${b.y} ${b.x + b.w},${b.y + b.h} ${b.x},${b.y + b.h}`;
const polyStar = (b: any) => { const cx = b.x + b.w / 2, cy = b.y + b.h / 2, R = Math.min(b.w, b.h) / 2, r = R * 0.42, mn = Math.min(b.w, b.h); return Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 ? r : R; return `${num(cx + rad * Math.cos(a) * (b.w / mn))},${num(cy + rad * Math.sin(a) * (b.h / mn))}`; }).join(' '); };
const arrowHead = (p: { x: number; y: number }, ang: number, size = 9) => { const a1 = ang + Math.PI - 0.42, a2 = ang + Math.PI + 0.42; return `${num(p.x)},${num(p.y)} ${num(p.x + size * Math.cos(a1))},${num(p.y + size * Math.sin(a1))} ${num(p.x + size * Math.cos(a2))},${num(p.y + size * Math.sin(a2))}`; };
const stripHtml = (html: string) => { const d = document.createElement('div'); d.innerHTML = html || ''; return (d.textContent || '').trim(); };

const bboxOf = (el: E, map: Map<string, E>): { x: number; y: number; w: number; h: number } => {
  if (el.type === 'text') return { x: el.x, y: el.y - el.size, w: Math.max(40, (el.text || '').length * el.size * 0.6), h: el.size + 6 };
  if (el.type === 'path') return el.points?.length ? pathBounds(el.points) : { x: 0, y: 0, w: 0, h: 0 };
  if (el.type === 'line' || el.type === 'arrow') return { x: Math.min(el.x1, el.x2), y: Math.min(el.y1, el.y2), w: Math.abs(el.x2 - el.x1), h: Math.abs(el.y2 - el.y1) };
  if (el.type === 'connector') { const a = map.get(el.from), b = map.get(el.to); if (!a || !b) return { x: 0, y: 0, w: 0, h: 0 }; const ca = center(bboxOf(a, map)), cb = center(bboxOf(b, map)); return { x: Math.min(ca.x, cb.x), y: Math.min(ca.y, cb.y), w: Math.abs(cb.x - ca.x), h: Math.abs(cb.y - ca.y) }; }
  return { x: el.x, y: el.y, w: el.w, h: el.h };
};

const wrapText = (s: string, x: number, y: number, fontSize: number, maxW: number, color: string, anchor: string, weight = 400) => {
  const words = (s || '').split(/\s+/).filter(Boolean); if (!words.length) return '';
  const maxChars = Math.max(4, Math.floor(maxW / (fontSize * 0.55)));
  const lines: string[] = []; let line = '';
  for (const w of words) { if ((line + ' ' + w).trim().length > maxChars && line) { lines.push(line); line = w; } else line = (line + ' ' + w).trim(); }
  if (line) lines.push(line);
  const tspans = lines.slice(0, 12).map((ln, i) => `<tspan x="${num(x)}" dy="${i === 0 ? 0 : fontSize * 1.25}">${esc(ln)}</tspan>`).join('');
  return `<text x="${num(x)}" y="${num(y + fontSize)}" font-family="'Hanken Grotesk', sans-serif" font-size="${fontSize}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${tspans}</text>`;
};

const renderEl = (el: E, map: Map<string, E>, imageData: Map<string, string>): string => {
  const op = el.opacity ?? 1;
  const dash = el.dash ? ` stroke-dasharray="6 5"` : '';
  const sw = el.strokeWidth ?? 2;
  const stroke = el.stroke || '#211e19';
  const fill = el.fill && el.fill !== 'none' ? el.fill : 'none';
  const wrap = (inner: string) => `<g opacity="${op}">${inner}</g>`;

  if (el.type === 'connector') {
    const a = map.get(el.from), b = map.get(el.to); if (!a || !b) return '';
    const ba = bboxOf(a, map), bb = bboxOf(b, map);
    const s = edgePoint(ba, center(bb)), e = edgePoint(bb, center(ba));
    const ang = Math.atan2(e.y - s.y, e.x - s.x);
    return wrap(`<line x1="${num(s.x)}" y1="${num(s.y)}" x2="${num(e.x)}" y2="${num(e.y)}" stroke="${stroke}" stroke-width="${sw}"${dash}/>${el.arrow !== false ? `<polygon points="${arrowHead(e, ang)}" fill="${stroke}"/>` : ''}`);
  }
  if (el.type === 'line' || el.type === 'arrow') {
    const ang = Math.atan2(el.y2 - el.y1, el.x2 - el.x1);
    return wrap(`<line x1="${num(el.x1)}" y1="${num(el.y1)}" x2="${num(el.x2)}" y2="${num(el.y2)}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"${dash}/>${el.type === 'arrow' ? `<polygon points="${arrowHead({ x: el.x2, y: el.y2 }, ang)}" fill="${stroke}"/>` : ''}`);
  }
  if (el.type === 'path') return wrap(`<path d="${smoothPathD(el.points || [])}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${dash}/>`);
  if (el.type === 'text') { const anchor = el.align === 'center' ? 'middle' : el.align === 'right' ? 'end' : 'start'; return wrap(`<text x="${num(el.x)}" y="${num(el.y)}" font-family="'Hanken Grotesk', sans-serif" font-size="${el.size}" font-weight="600" fill="${stroke}" text-anchor="${anchor}">${esc(el.text || '')}</text>`); }
  if (el.type === 'image') { const href = imageData.get(el.url) || el.url; return wrap(`<clipPath id="cl${el.id}"><rect x="${num(el.x)}" y="${num(el.y)}" width="${num(el.w)}" height="${num(el.h)}" rx="4"/></clipPath><image href="${esc(href)}" x="${num(el.x)}" y="${num(el.y)}" width="${num(el.w)}" height="${num(el.h)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#cl${el.id})"/>`); }
  if (el.type === 'task') {
    const st = TASK_STATUSES.find((s) => s.id === el.status); const pr = el.priority ? (PRIORITY_CONFIG as any)[el.priority] : null;
    const head = `${pr ? `<circle cx="${num(el.x + 12)}" cy="${num(el.y + 16)}" r="3" fill="${pr.color}"/>` : ''}<text x="${num(el.x + (pr ? 22 : 12))}" y="${num(el.y + 20)}" font-family="'Hanken Grotesk', sans-serif" font-size="10" fill="#94a3b8">#${esc(String(el.identifier ?? ''))}</text>${st ? `<rect x="${num(el.x + el.w - 70)}" y="${num(el.y + 9)}" width="60" height="15" rx="7.5" fill="${st.color}"/><text x="${num(el.x + el.w - 40)}" y="${num(el.y + 20)}" font-family="'Hanken Grotesk', sans-serif" font-size="9" fill="#fff" text-anchor="middle">${esc(st.label)}</text>` : ''}`;
    return wrap(`<rect x="${num(el.x)}" y="${num(el.y)}" width="${num(el.w)}" height="${num(el.h)}" rx="12" fill="#ffffff" stroke="#e2e8f0"/>${head}${wrapText(el.title || '', el.x + 12, el.y + 30, 12, el.w - 24, '#334155', 'start', 600)}`);
  }
  // shapes
  const b = { x: el.x, y: el.y, w: el.w, h: el.h };
  let shape = '';
  if (el.type === 'ellipse') shape = `<ellipse cx="${num(b.x + b.w / 2)}" cy="${num(b.y + b.h / 2)}" rx="${num(b.w / 2)}" ry="${num(b.h / 2)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash}/>`;
  else if (el.type === 'diamond') shape = `<polygon points="${polyDiamond(b)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash}/>`;
  else if (el.type === 'triangle') shape = `<polygon points="${polyTriangle(b)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash}/>`;
  else if (el.type === 'star') shape = `<polygon points="${polyStar(b)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash}/>`;
  else shape = `<rect x="${num(b.x)}" y="${num(b.y)}" width="${num(b.w)}" height="${num(b.h)}" rx="${el.type === 'note' ? 8 : el.type === 'frame' ? 4 : 6}" fill="${el.type === 'note' ? (el.fill || '#fde68a') : fill}" stroke="${stroke}" stroke-width="${sw}"${dash}/>`;
  let label = '';
  if (el.type === 'frame') label = `<text x="${num(b.x + 8)}" y="${num(b.y - 6)}" font-family="'Hanken Grotesk', sans-serif" font-size="12" font-weight="600" fill="#64748b">${esc(el.text || 'Frame')}</text>`;
  else if (el.type === 'note') { const t = el.html ? stripHtml(el.html) : (el.text || ''); if (t) label = wrapText(t, b.x + 8, b.y + 6, el.fontSize || 14, b.w - 16, '#1e293b', 'start'); }
  else if (el.text) label = `<text x="${num(b.x + b.w / 2)}" y="${num(b.y + b.h / 2 + (el.fontSize || 14) / 3)}" font-family="'Hanken Grotesk', sans-serif" font-size="${el.fontSize || 14}" font-weight="500" fill="${stroke}" text-anchor="middle">${esc(el.text)}</text>`;
  return wrap(shape + label);
};

export const boardToSVG = (elements: E[], opts: { pad?: number; background?: string; imageData?: Map<string, string> } = {}): { svg: string; width: number; height: number } => {
  const pad = opts.pad ?? 48; const bg = opts.background ?? '#ffffff';
  const map = new Map(elements.map((e) => [e.id, e]));
  const visible = elements.filter((e) => !(e.type === 'connector' && (!map.get(e.from) || !map.get(e.to))));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of visible) { const b = bboxOf(el, map); if (!b.w && !b.h && el.type === 'connector') continue; minX = Math.min(minX, b.x); minY = Math.min(minY, b.y); maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h); }
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 400; maxY = 300; }
  const W = Math.max(1, maxX - minX + pad * 2), H = Math.max(1, maxY - minY + pad * 2);
  const body = visible.map((el) => renderEl(el, map, opts.imageData ?? new Map())).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${num(W)}" height="${num(H)}" viewBox="0 0 ${num(W)} ${num(H)}"><rect width="${num(W)}" height="${num(H)}" fill="${bg}"/><g transform="translate(${num(pad - minX)} ${num(pad - minY)})">${body}</g></svg>`;
  return { svg, width: W, height: H };
};

// Fetch each unique image as a data URL so PNG/PDF rasterization isn't tainted.
export const collectImageData = async (elements: E[]): Promise<Map<string, string>> => {
  const urls = Array.from(new Set(elements.filter((e) => e.type === 'image' && e.url).map((e) => e.url as string)));
  const out = new Map<string, string>();
  await Promise.all(urls.map(async (url) => {
    try {
      const res = await fetch(url, { mode: 'cors' }); const blob = await res.blob();
      const data = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result as string); r.onerror = reject; r.readAsDataURL(blob); });
      out.set(url, data);
    } catch { /* leave out; renders as remote href in SVG, placeholder in raster */ }
  }));
  return out;
};

const svgToImage = (svg: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  const img = new Image();
  img.onload = () => { resolve(img); URL.revokeObjectURL(url); };
  img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
  img.src = url;
});

const rasterize = async (svg: string, width: number, height: number, background: string): Promise<HTMLCanvasElement> => {
  const scale = Math.min(2, 4000 / Math.max(width, height));
  const img = await svgToImage(svg);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = background; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
};

const download = (blob: Blob, filename: string) => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
const safeName = (name: string) => (name || 'whiteboard').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'whiteboard';

export const exportSVG = (elements: E[], name: string) => { const { svg } = boardToSVG(elements); download(new Blob([svg], { type: 'image/svg+xml' }), `${safeName(name)}.svg`); };

export const exportPNG = async (elements: E[], name: string) => {
  const imageData = await collectImageData(elements);
  const { svg, width, height } = boardToSVG(elements, { imageData });
  const canvas = await rasterize(svg, width, height, '#ffffff');
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
  if (blob) download(blob, `${safeName(name)}.png`);
};

export const copyPNGToClipboard = async (elements: E[]) => {
  const imageData = await collectImageData(elements);
  const { svg, width, height } = boardToSVG(elements, { imageData });
  const canvas = await rasterize(svg, width, height, '#ffffff');
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
  if (!blob) throw new Error('render failed');
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
};

// Minimal single-image PDF (DCTDecode/JPEG XObject) — no external dependency.
const jpegToPdf = (jpeg: Uint8Array, w: number, h: number): Blob => {
  const enc = (s: string) => { const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 0xff; return a; };
  const concat = (arrs: Uint8Array[]) => { const len = arrs.reduce((n, a) => n + a.length, 0); const out = new Uint8Array(len); let o = 0; for (const a of arrs) { out.set(a, o); o += a.length; } return out; };
  const parts: Uint8Array[] = []; const xref: number[] = []; let offset = 0;
  const push = (b: Uint8Array) => { parts.push(b); offset += b.length; };
  const addObj = (b: Uint8Array) => { xref.push(offset); push(b); };
  push(enc('%PDF-1.3\n%\xFF\xFF\xFF\xFF\n'));
  addObj(enc('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'));
  addObj(enc('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n'));
  addObj(enc(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`));
  addObj(concat([enc(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`), jpeg, enc('\nendstream\nendobj\n')]));
  const content = `q\n${w} 0 0 ${h} 0 0 cm\n/Im0 Do\nQ\n`;
  addObj(enc(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`));
  const xrefStart = offset;
  let x = `xref\n0 ${xref.length + 1}\n0000000000 65535 f \n`;
  for (const o of xref) x += `${String(o).padStart(10, '0')} 00000 n \n`;
  push(enc(`${x}trailer\n<< /Size ${xref.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`));
  return new Blob([concat(parts)], { type: 'application/pdf' });
};

export const exportPDF = async (elements: E[], name: string) => {
  const imageData = await collectImageData(elements);
  const { svg, width, height } = boardToSVG(elements, { imageData });
  const canvas = await rasterize(svg, width, height, '#ffffff');
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const bin = atob(dataUrl.split(',')[1]); const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  download(jpegToPdf(bytes, canvas.width, canvas.height), `${safeName(name)}.pdf`);
};
