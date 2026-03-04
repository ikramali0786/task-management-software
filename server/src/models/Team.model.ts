import mongoose, { Schema, Document } from 'mongoose';

export type TeamRole = 'admin' | 'moderator' | 'member' | 'viewer';

export interface IMember {
  user: mongoose.Types.ObjectId;
  role: TeamRole;
  joinedAt: Date;
}

export interface ITeam extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  slug: string;
  avatar: string | null;
  members: IMember[];
  owner: mongoose.Types.ObjectId;
  inviteCodes: Array<{
    code: string;
    expiresAt: Date;
    usedBy: mongoose.Types.ObjectId | null;
  }>;
  settings: {
    allowMemberInvite: boolean;
    isLocked: boolean;
    defaultTaskPriority: 'urgent' | 'high' | 'medium' | 'low';
  };
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MemberSchema = new Schema<IMember>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['admin', 'moderator', 'member', 'viewer'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const TeamSchema = new Schema<ITeam>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, maxlength: 300, default: '' },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    avatar: { type: String, default: null },
    members: [MemberSchema],
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    inviteCodes: [
      {
        code: String,
        expiresAt: Date,
        usedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      },
    ],
    settings: {
      allowMemberInvite: { type: Boolean, default: false },
      isLocked: { type: Boolean, default: false }, // when true, only admins can create/edit tasks
      defaultTaskPriority: {
        type: String,
        enum: ['urgent', 'high', 'medium', 'low'],
        default: 'medium',
      },
    },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

TeamSchema.index({ slug: 1 });
TeamSchema.index({ 'members.user': 1 });
TeamSchema.index({ owner: 1 });

export const Team = mongoose.model<ITeam>('Team', TeamSchema);
