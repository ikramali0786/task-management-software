import mongoose, { Schema, Document } from 'mongoose';

/**
 * A single freeform whiteboard per team. Elements (notes, shapes, pen strokes,
 * text) are stored as a loosely-typed array; the client owns the schema. Saves
 * are full-document (boards are small JSON) with last-writer-wins.
 */
export interface IWhiteboard extends Document {
  _id: mongoose.Types.ObjectId;
  team: mongoose.Types.ObjectId;
  elements: any[];
  updatedBy: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const WhiteboardSchema = new Schema<IWhiteboard>(
  {
    team: { type: Schema.Types.ObjectId, ref: 'Team', required: true, unique: true },
    elements: { type: Schema.Types.Mixed, default: [] },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

export const Whiteboard = mongoose.model<IWhiteboard>('Whiteboard', WhiteboardSchema);
