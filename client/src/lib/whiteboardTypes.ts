/** Element + tool type model for the whiteboard canvas. */

export type Tool =
  | 'select' | 'pan' | 'note' | 'rect' | 'ellipse' | 'diamond' | 'triangle' | 'star'
  | 'line' | 'arrow' | 'connector' | 'pen' | 'text' | 'frame' | 'eraser';
export type Align = 'left' | 'center' | 'right';
export type Style = { fill?: string; stroke?: string; strokeWidth?: number; dash?: boolean; opacity?: number };
export type Base = { id: string; locked?: boolean } & Style;
export type ShapeType = 'note' | 'rect' | 'ellipse' | 'diamond' | 'triangle' | 'star' | 'frame';
export type Shape = Base & { type: ShapeType; x: number; y: number; w: number; h: number; text?: string; html?: string; fontSize?: number; align?: Align };
export type Txt = Base & { type: 'text'; x: number; y: number; text: string; size: number; align?: Align };
export type PathEl = Base & { type: 'path'; points: number[][]; width?: number };
export type LineEl = Base & { type: 'line' | 'arrow'; x1: number; y1: number; x2: number; y2: number };
export type ImageEl = Base & { type: 'image'; x: number; y: number; w: number; h: number; url: string };
export type TaskEl = Base & { type: 'task'; x: number; y: number; w: number; h: number; taskId: string; title: string; identifier?: number; status: string; priority?: string };
export type Connector = Base & { type: 'connector'; from: string; to: string; arrow?: boolean };
export type El = Shape | Txt | PathEl | LineEl | ImageEl | TaskEl | Connector;

export type GridMode = 'dots' | 'lines' | 'off';
export type Peer = { name: string; x: number; y: number; ids: string[]; lastSeen: number };
