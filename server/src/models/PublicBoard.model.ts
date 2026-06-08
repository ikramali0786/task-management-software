import mongoose, { Schema, Document } from 'mongoose';

/**
 * A read-only public share of a team's board, identified by an unguessable
 * token. One per team. Renders at /b/:token and is iframe-embeddable.
 */
export interface IPublicBoard extends Document {
  _id: mongoose.Types.ObjectId;
  team: mongoose.Types.ObjectId;
  token: string;
  enabled: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PublicBoardSchema = new Schema<IPublicBoard>(
  {
    team: { type: Schema.Types.ObjectId, ref: 'Team', required: true, unique: true },
    token: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const PublicBoard = mongoose.model<IPublicBoard>('PublicBoard', PublicBoardSchema);
