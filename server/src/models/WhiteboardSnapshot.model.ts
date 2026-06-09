import mongoose, { Schema, Document } from 'mongoose';

/**
 * A point-in-time snapshot of a whiteboard's elements, used for version
 * history / restore. Created manually ("Save version") or automatically on
 * save (at most one per ~10 min). Capped to the most recent ~30 per board.
 */
export interface IWhiteboardSnapshot extends Document {
  _id: mongoose.Types.ObjectId;
  board: mongoose.Types.ObjectId;
  team: mongoose.Types.ObjectId;
  elements: any[];
  preview: any[];
  label: string;
  createdBy: mongoose.Types.ObjectId | null;
  createdAt: Date;
}

const WhiteboardSnapshotSchema = new Schema<IWhiteboardSnapshot>(
  {
    board: { type: Schema.Types.ObjectId, ref: 'Whiteboard', required: true, index: true },
    team: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    elements: { type: Schema.Types.Mixed, default: [] },
    preview: { type: Schema.Types.Mixed, default: [] },
    label: { type: String, default: 'Snapshot', maxlength: 80 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const WhiteboardSnapshot = mongoose.model<IWhiteboardSnapshot>('WhiteboardSnapshot', WhiteboardSnapshotSchema);
