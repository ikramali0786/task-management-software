import mongoose, { Schema, Document } from 'mongoose';

export interface IChatbot extends Omit<Document, 'model'> {
  _id: mongoose.Types.ObjectId;
  team: mongoose.Types.ObjectId;
  name: string;
  description: string;
  systemPrompt: string;
  model: string;
  icon: string;
  color: string;
  createdBy: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ChatbotSchema = new Schema<IChatbot>(
  {
    team: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    name: { type: String, required: true, trim: true, maxlength: 50 },
    description: { type: String, default: '', maxlength: 200 },
    systemPrompt: { type: String, default: '', maxlength: 4000 },
    model: {
      type: String,
      enum: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
      default: 'gpt-4o-mini',
    },
    icon: { type: String, default: '🤖' },
    color: { type: String, default: 'indigo' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ChatbotSchema.index({ team: 1, isActive: 1 });

export const Chatbot = mongoose.model<IChatbot>('Chatbot', ChatbotSchema);
