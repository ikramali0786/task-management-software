import mongoose, { Schema, Document } from 'mongoose';

/**
 * A wiki/knowledge-base page belonging to a team. Pages nest via `parent` to
 * form a document tree. Content is markdown; saves are full-document with
 * last-writer-wins (pages are small) and broadcast over sockets for live sync.
 */
export interface IDoc extends Document {
  _id: mongoose.Types.ObjectId;
  team: mongoose.Types.ObjectId;
  title: string;
  content: string;
  icon: string;
  parent: mongoose.Types.ObjectId | null;
  position: number;
  isArchived: boolean;
  createdBy: mongoose.Types.ObjectId | null;
  updatedBy: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const DocSchema = new Schema<IDoc>(
  {
    team: { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    title: { type: String, default: 'Untitled', trim: true, maxlength: 200 },
    content: { type: String, default: '' },
    icon: { type: String, default: '📄', maxlength: 8 },
    parent: { type: Schema.Types.ObjectId, ref: 'Doc', default: null, index: true },
    position: { type: Number, default: 0 },
    isArchived: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

export const Doc = mongoose.model<IDoc>('Doc', DocSchema);
