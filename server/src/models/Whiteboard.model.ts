import mongoose, { Schema, Document } from 'mongoose';

/**
 * A named freeform whiteboard. A team can own many boards. Elements (notes,
 * shapes, connectors, pen strokes, images, task cards…) are stored as a
 * loosely-typed array; the client owns the schema. Saves are full-document
 * (boards are small JSON) with last-writer-wins. `preview` is a tiny array of
 * element bounding boxes used to render board thumbnails without shipping the
 * whole element payload in board listings.
 */
export interface IWhiteboardPreview {
  x: number;
  y: number;
  w: number;
  h: number;
  c: string;
}

export interface IWhiteboard extends Document {
  _id: mongoose.Types.ObjectId;
  team: mongoose.Types.ObjectId;
  name: string;
  elements: any[];
  preview: IWhiteboardPreview[];
  isPublic: boolean;
  publicToken: string | null;
  createdBy: mongoose.Types.ObjectId | null;
  updatedBy: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const WhiteboardSchema = new Schema<IWhiteboard>(
  {
    team: { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    name: { type: String, default: 'Untitled board', trim: true, maxlength: 80 },
    elements: { type: Schema.Types.Mixed, default: [] },
    preview: { type: Schema.Types.Mixed, default: [] },
    isPublic: { type: Boolean, default: false },
    publicToken: { type: String, default: null, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

export const Whiteboard = mongoose.model<IWhiteboard>('Whiteboard', WhiteboardSchema);
