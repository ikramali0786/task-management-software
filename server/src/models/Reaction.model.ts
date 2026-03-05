import mongoose, { Schema, Document } from 'mongoose';

export interface IReaction extends Document {
  _id: mongoose.Types.ObjectId;
  resource: mongoose.Types.ObjectId;
  resourceType: 'task' | 'comment' | 'discussion';
  team: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  emoji: string;
  createdAt: Date;
}

const ReactionSchema = new Schema<IReaction>(
  {
    resource: { type: Schema.Types.ObjectId, required: true },
    resourceType: { type: String, enum: ['task', 'comment', 'discussion'], required: true },
    team: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    emoji: { type: String, required: true, maxlength: 8 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// One reaction per user per emoji per resource
ReactionSchema.index({ resource: 1, user: 1, emoji: 1 }, { unique: true });
ReactionSchema.index({ resource: 1 });

export const Reaction = mongoose.model<IReaction>('Reaction', ReactionSchema);
