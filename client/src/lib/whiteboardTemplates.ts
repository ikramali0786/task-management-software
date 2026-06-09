// Whiteboard starter templates. Each returns an array of loosely-typed elements
// matching the schema WhiteboardPage uses (id/type/geometry + fill/stroke style).
// They already carry fill/stroke so the page's legacy migration passes them through.

const uid = () => Math.random().toString(36).slice(2, 10);
const hexA = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

type E = Record<string, any>;
const frame = (x: number, y: number, w: number, h: number, title: string): E => ({ id: uid(), type: 'frame', x, y, w, h, text: title, fill: hexA('#94a3b8', 0.06), stroke: '#94a3b8', strokeWidth: 1.5, dash: true, opacity: 1, fontSize: 14, align: 'center' });
const note = (x: number, y: number, fill: string, html = ''): E => ({ id: uid(), type: 'note', x, y, w: 150, h: 110, fill, stroke: '#00000018', strokeWidth: 1, opacity: 1, fontSize: 14, align: 'left', html });
const text = (x: number, y: number, str: string, size = 26): E => ({ id: uid(), type: 'text', x, y, text: str, size, align: 'left', stroke: '#211e19', opacity: 1 });
const shape = (type: string, x: number, y: number, w: number, h: number, label: string, stroke: string): E => ({ id: uid(), type, x, y, w, h, text: label, fill: hexA(stroke, 0.12), stroke, strokeWidth: 2, opacity: 1, fontSize: 14, align: 'center' });
const connect = (from: string, to: string): E => ({ id: uid(), type: 'connector', from, to, arrow: true, stroke: '#64748b', strokeWidth: 2, dash: false, opacity: 1 });

export interface WBTemplate { id: string; name: string; description: string; build: () => E[] }

const NOTE_COLORS = ['#fde68a', '#fecaca', '#bbf7d0', '#bfdbfe', '#e9d5ff', '#fed7aa'];

export const WHITEBOARD_TEMPLATES: WBTemplate[] = [
  { id: 'blank', name: 'Blank', description: 'Start from an empty canvas.', build: () => [] },
  {
    id: 'brainstorm', name: 'Brainstorm', description: 'Central topic with idea notes around it.',
    build: () => {
      const els: E[] = [text(120, 70, 'Brainstorm', 30), frame(100, 110, 620, 360, 'Ideas')];
      els.push({ ...note(360, 250, '#e8502e', '<b>Topic</b>') });
      const spots = [[150, 150], [560, 150], [150, 360], [560, 360], [360, 130], [360, 380]];
      spots.forEach(([x, y], i) => els.push(note(x, y, NOTE_COLORS[i % NOTE_COLORS.length])));
      return els;
    },
  },
  {
    id: 'retro', name: 'Sprint retro', description: 'What went well / to improve / action items.',
    build: () => {
      const cols = [['What went well', '#bbf7d0'], ['What to improve', '#fecaca'], ['Action items', '#bfdbfe']];
      const els: E[] = [text(120, 70, 'Sprint Retrospective', 28)];
      cols.forEach(([title, fill], i) => {
        const x = 110 + i * 320;
        els.push(frame(x, 110, 280, 420, title as string));
        els.push(note(x + 20, 160, fill as string));
        els.push(note(x + 20, 290, fill as string));
      });
      return els;
    },
  },
  {
    id: 'flowchart', name: 'Flowchart', description: 'Start → process → decision → end, pre-linked.',
    build: () => {
      const start = shape('ellipse', 320, 100, 160, 70, 'Start', '#22c55e');
      const proc = shape('rect', 320, 230, 160, 80, 'Process', '#0ea5e9');
      const dec = shape('diamond', 310, 370, 180, 110, 'Decision?', '#f59e0b');
      const done = shape('ellipse', 320, 540, 160, 70, 'End', '#e8502e');
      return [start, proc, dec, done, connect(start.id, proc.id), connect(proc.id, dec.id), connect(dec.id, done.id)];
    },
  },
  {
    id: 'kanban', name: 'Kanban', description: 'To Do / In Progress / Done columns.',
    build: () => {
      const cols = [['To Do', '#fde68a'], ['In Progress', '#bfdbfe'], ['Done', '#bbf7d0']];
      const els: E[] = [text(120, 70, 'Kanban', 28)];
      cols.forEach(([title, fill], i) => {
        const x = 110 + i * 320;
        els.push(frame(x, 110, 280, 460, title as string));
        els.push(note(x + 20, 160, fill as string));
        els.push(note(x + 20, 290, fill as string));
      });
      return els;
    },
  },
];
