import mongoose, { Schema, Document } from 'mongoose';

export interface IDiscussion extends Document {
  _id: mongoose.Types.ObjectId;
  team: mongoose.Types.ObjectId;
  author: mongoose.Types.ObjectId;
  body: string;
  parentDiscussion: mongoose.Types.ObjectId | null;
  mentions: mongoose.Types.ObjectId[];
  editedAt: Date | null;
  isDeleted: boolean;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DiscussionSchema = new Schema<IDiscussion>(
  {
    team: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, maxlength: 4000 },
    parentDiscussion: { type: Schema.Types.ObjectId, ref: 'Discussion', default: null },
    mentions: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    editedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
    isPinned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

DiscussionSchema.index({ team: 1, parentDiscussion: 1, createdAt: -1 });
DiscussionSchema.index({ team: 1, isPinned: -1, createdAt: -1 });

export const Discussion = mongoose.model<IDiscussion>('Discussion', DiscussionSchema);
