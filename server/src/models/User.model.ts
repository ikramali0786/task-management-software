import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  username: string;
  email: string;
  password: string;
  avatar: string | null;
  timezone: string;
  theme: 'light' | 'dark' | 'system';
  emailNotifications: boolean;
  teams: mongoose.Types.ObjectId[];
  isActive: boolean;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
  // Security fields
  refreshTokenHash: string | null;
  loginAttempts: number;
  lockUntil: Date | null;
  // Password reset & email verification
  emailVerified: boolean;
  passwordResetTokenHash: string | null;
  passwordResetExpires: Date | null;
  emailVerificationTokenHash: string | null;
  emailVerificationExpires: Date | null;
  // Two-factor auth (TOTP). Secret is AES-GCM encrypted; recovery codes are sha256 hashes.
  twoFactorEnabled: boolean;
  twoFactorSecret: string | null;          // JSON of { encryptedKey, iv, authTag }
  twoFactorPendingSecret: string | null;   // same shape, during enrollment (pre-verify)
  twoFactorRecoveryCodes: string[];        // sha256 hashes of unused codes
  comparePassword(candidate: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    username: { type: String, unique: true, sparse: true, lowercase: true, trim: true, maxlength: 30 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },
    avatar: { type: String, default: null },
    timezone: { type: String, default: 'UTC' },
    theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
    emailNotifications: { type: Boolean, default: true },
    teams: [{ type: Schema.Types.ObjectId, ref: 'Team' }],
    isActive: { type: Boolean, default: true },
    lastSeenAt: { type: Date, default: Date.now },
    // Security fields
    refreshTokenHash: { type: String, select: false, default: null },
    loginAttempts:    { type: Number, select: false, default: 0 },
    lockUntil:        { type: Date,   select: false, default: null },
    // Password reset & email verification (token hashes only — never store raw tokens)
    emailVerified:               { type: Boolean, default: false },
    passwordResetTokenHash:      { type: String, select: false, default: null },
    passwordResetExpires:        { type: Date,   select: false, default: null },
    emailVerificationTokenHash:  { type: String, select: false, default: null },
    emailVerificationExpires:    { type: Date,   select: false, default: null },
    // Two-factor auth
    twoFactorEnabled:        { type: Boolean, default: false },
    twoFactorSecret:         { type: String, select: false, default: null },
    twoFactorPendingSecret:  { type: String, select: false, default: null },
    twoFactorRecoveryCodes:  { type: [String], select: false, default: [] },
  },
  { timestamps: true }
);

UserSchema.index({ teams: 1 });

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

export const User = mongoose.model<IUser>('User', UserSchema);
