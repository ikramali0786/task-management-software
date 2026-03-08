import mongoose, { Schema, Document } from 'mongoose';

export type TeamRole = 'owner' | 'admin' | 'moderator' | 'member' | 'viewer';

export interface IRolePermissions {
  createTask: boolean;
  editOwnTask: boolean;
  editAnyTask: boolean;
  deleteOwnTask: boolean;
  deleteAnyTask: boolean;
  manageMembers: boolean;
  manageTeamSettings: boolean;
  inviteMembers: boolean;
  commentOnTasks: boolean;
  viewWorkload: boolean;
}

export interface ICustomRole {
  _id: mongoose.Types.ObjectId;
  name: string;
  color: string;
  permissions: IRolePermissions;
}

export interface IMember {
  user: mongoose.Types.ObjectId;
  role: string; // built-in TeamRole or custom role name
  joinedAt: Date;
}

export interface ITeam extends Document {
  _id: mongoose.Types.ObjectId;
  taskCounter: number;   // monotonically increasing — used to assign task identifiers
  name: string;
  description: string;
  slug: string;
  avatar: string | null;
  members: IMember[];
  owner: mongoose.Types.ObjectId;
  customRoles: ICustomRole[];
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

const PermissionsSchema = new Schema<IRolePermissions>(
  {
    createTask: { type: Boolean, default: true },
    editOwnTask: { type: Boolean, default: true },
    editAnyTask: { type: Boolean, default: false },
    deleteOwnTask: { type: Boolean, default: true },
    deleteAnyTask: { type: Boolean, default: false },
    manageMembers: { type: Boolean, default: false },
    manageTeamSettings: { type: Boolean, default: false },
    inviteMembers: { type: Boolean, default: false },
    commentOnTasks: { type: Boolean, default: true },
    viewWorkload: { type: Boolean, default: true },
  },
  { _id: false }
);

const CustomRoleSchema = new Schema<ICustomRole>({
  name: { type: String, required: true, maxlength: 40 },
  color: { type: String, default: '#6366f1' },
  permissions: { type: PermissionsSchema, default: () => ({}) },
});

const MemberSchema = new Schema<IMember>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, default: 'member' },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const TeamSchema = new Schema<ITeam>(
  {
    taskCounter: { type: Number, default: 0 },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, maxlength: 300, default: '' },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    avatar: { type: String, default: null },
    members: [MemberSchema],
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    customRoles: { type: [CustomRoleSchema], default: [] },
    inviteCodes: [
      {
        code: String,
        expiresAt: Date,
        usedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      },
    ],
    settings: {
      allowMemberInvite: { type: Boolean, default: false },
      isLocked: { type: Boolean, default: false },
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

TeamSchema.index({ 'members.user': 1 });
TeamSchema.index({ owner: 1 });

export const Team = mongoose.model<ITeam>('Team', TeamSchema);
