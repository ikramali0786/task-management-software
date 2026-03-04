import mongoose, { Schema, Document } from 'mongoose';

export interface IComment extends Document {
  _id: mongoose.Types.ObjectId;
  task: mongoose.Types.ObjectId;
  author: mongoose.Types.ObjectId;
  body: string;
  parentComment: mongoose.Types.ObjectId | null;
  mentions: mongoose.Types.ObjectId[];
  editedAt: Date | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    task: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, maxlength: 2000 },
    parentComment: { type: Schema.Types.ObjectId, ref: 'Comment', default: null },
    mentions: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    editedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

CommentSchema.index({ task: 1, parentComment: 1, createdAt: 1 });

export const Comment = mongoose.model<IComment>('Comment', CommentSchema);
