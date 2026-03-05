import mongoose, { Document, Schema } from 'mongoose';

export interface IAttachment extends Document {
  task: mongoose.Types.ObjectId;
  team: mongoose.Types.ObjectId;
  uploadedBy: mongoose.Types.ObjectId;
  filename: string;        // Original file name shown to users
  fileKey: string;         // R2 object key  (tasks/<taskId>/<uuid>-<name>)
  publicUrl: string;       // Direct R2 public URL
  contentType: string;     // MIME type
  size: number;            // File size in bytes
  createdAt: Date;
  updatedAt: Date;
}

const AttachmentSchema = new Schema<IAttachment>(
  {
    task:       { type: Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
    team:       { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    filename:   { type: String, required: true, trim: true, maxlength: 255 },
    fileKey:    { type: String, required: true, unique: true },
    publicUrl:  { type: String, required: true },
    contentType:{ type: String, required: true },
    size:       { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

export const Attachment = mongoose.model<IAttachment>('Attachment', AttachmentSchema);
