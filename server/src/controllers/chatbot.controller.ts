import { Request, Response } from 'express';
import { z } from 'zod';
import OpenAI from 'openai';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { Chatbot } from '../models/Chatbot.model';
import { Team } from '../models/Team.model';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { getDecryptedKey } from './apiKey.controller';

// Local interface so we don't depend on Express.Multer namespace augmentation
interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const verifyMember = async (teamId: string, userId: string) => {
  const team = await Team.findById(teamId);
  if (!team) throw new ApiError(404, 'Team not found.');
  const member = team.members.find((m) => m.user.toString() === userId);
  if (!member) throw new ApiError(403, 'Not a member of this team.');
  return { team, member };
};

const requireAdmin = (member: { role: string }) => {
  if (member.role !== 'admin' && member.role !== 'owner') {
    throw new ApiError(403, 'Only admins can manage chatbots.');
  }
};

/* ── GET all bots for a team ─────────────────────────────────────────────── */
export const getChatbots = asyncHandler(async (req: Request, res: Response) => {
  const { teamId } = req.query as { teamId: string };
  if (!teamId) throw new ApiError(400, 'teamId is required.');

  await verifyMember(teamId, req.user!._id.toString());

  const chatbots = await Chatbot.find({ team: teamId, isActive: true })
    .populate('createdBy', 'name avatar')
    .sort({ createdAt: 1 });

  sendSuccess(res, { chatbots });
});

/* ── CREATE chatbot ──────────────────────────────────────────────────────── */
export const createChatbot = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    teamId: z.string(),
    name: z.string().min(1).max(50),
    description: z.string().max(200).optional(),
    systemPrompt: z.string().max(4000).optional(),
    model: z.enum(['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo']).optional(),
    icon: z.string().max(4).optional(),
    color: z.string().max(20).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const userId = req.user!._id.toString();
  const { member } = await verifyMember(parsed.data.teamId, userId);
  requireAdmin(member);

  const chatbot = await Chatbot.create({
    team: parsed.data.teamId,
    name: parsed.data.name,
    description: parsed.data.description || '',
    systemPrompt: parsed.data.systemPrompt || '',
    model: parsed.data.model || 'gpt-4o-mini',
    icon: parsed.data.icon || '🤖',
    color: parsed.data.color || 'indigo',
    createdBy: userId,
  });

  const populated = await chatbot.populate('createdBy', 'name avatar');
  sendSuccess(res, { chatbot: populated }, 'Chatbot created.', 201);
});

/* ── UPDATE chatbot ──────────────────────────────────────────────────────── */
export const updateChatbot = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    name: z.string().min(1).max(50).optional(),
    description: z.string().max(200).optional(),
    systemPrompt: z.string().max(4000).optional(),
    model: z.enum(['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo']).optional(),
    icon: z.string().max(4).optional(),
    color: z.string().max(20).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const chatbot = await Chatbot.findById(req.params.chatbotId);
  if (!chatbot || !chatbot.isActive) throw new ApiError(404, 'Chatbot not found.');

  const userId = req.user!._id.toString();
  const { member } = await verifyMember(chatbot.team.toString(), userId);
  requireAdmin(member);

  Object.assign(chatbot, parsed.data);
  await chatbot.save();

  sendSuccess(res, { chatbot });
});

/* ── DELETE chatbot (soft) ───────────────────────────────────────────────── */
export const deleteChatbot = asyncHandler(async (req: Request, res: Response) => {
  const chatbot = await Chatbot.findById(req.params.chatbotId);
  if (!chatbot || !chatbot.isActive) throw new ApiError(404, 'Chatbot not found.');

  const userId = req.user!._id.toString();
  const { member } = await verifyMember(chatbot.team.toString(), userId);
  requireAdmin(member);

  chatbot.isActive = false;
  await chatbot.save();

  sendSuccess(res, null, 'Chatbot deleted.');
});

/* ── SEND MESSAGE ────────────────────────────────────────────────────────── */
export const sendMessage = asyncHandler(async (req: Request, res: Response) => {
  // Parse body — supports both JSON (no file) and multipart/form-data (with file)
  let teamId: string;
  let rawMessages: unknown;

  // Always read teamId from body (works for both JSON and multipart).
  // Always JSON-parse messages when they arrive as a string — multipart fields
  // are always strings, and some Axios/browser combinations send multipart with
  // the instance-default Content-Type, bypassing the isMultipart check.
  teamId = req.body.teamId;
  const rawMsg = req.body.messages;
  if (typeof rawMsg === 'string') {
    try {
      rawMessages = JSON.parse(rawMsg);
    } catch {
      throw new ApiError(400, 'Invalid messages format.');
    }
  } else {
    rawMessages = rawMsg;
  }

  const schema = z.object({
    teamId: z.string(),
    messages: z
      .array(
        z.object({
          role: z.enum(['user', 'assistant']),
          content: z.string().max(8000),
        })
      )
      .min(1)
      .max(50),
  });

  const parsed = schema.safeParse({ teamId, messages: rawMessages });
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  const chatbot = await Chatbot.findById(req.params.chatbotId);
  if (!chatbot || !chatbot.isActive) throw new ApiError(404, 'Chatbot not found.');

  await verifyMember(parsed.data.teamId, req.user!._id.toString());

  const apiKeyPlain = await getDecryptedKey(parsed.data.teamId);
  if (!apiKeyPlain) {
    throw new ApiError(
      400,
      'No OpenAI API key configured for this team. Ask an admin to add one in Team Settings → AI & API.'
    );
  }

  // ── Process attached file ────────────────────────────────────────────────
  const file = (req as any).file as UploadedFile | undefined;
  let fileContentText: string | null = null;
  let fileImageBase64: string | null = null;
  let fileMimeType: string | null = null;

  if (file) {
    if (file.mimetype.startsWith('image/')) {
      // Vision — only GPT-4o family supports it
      if (chatbot.model === 'gpt-3.5-turbo') {
        throw new ApiError(
          400,
          'Image analysis requires GPT-4o or GPT-4o Mini. Update the bot\'s model in settings.'
        );
      }
      fileImageBase64 = file.buffer.toString('base64');
      fileMimeType = file.mimetype;
    } else if (file.mimetype === 'application/pdf') {
      try {
        const data = await pdfParse(file.buffer);
        fileContentText = data.text.trim().slice(0, 30000);
      } catch {
        throw new ApiError(422, 'Could not parse the PDF. Make sure it contains readable text.');
      }
    } else if (
      file.mimetype ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      try {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        fileContentText = result.value.trim().slice(0, 30000);
      } catch {
        throw new ApiError(422, 'Could not parse the Word document.');
      }
    } else if (file.mimetype.startsWith('text/')) {
      fileContentText = file.buffer.toString('utf-8').trim().slice(0, 30000);
    }

    if (fileContentText !== null && fileContentText.length === 0) {
      throw new ApiError(422, 'The attached file appears to be empty or contains no readable text.');
    }
  }

  const openai = new OpenAI({ apiKey: apiKeyPlain });

  // ── Build OpenAI messages array ──────────────────────────────────────────
  const systemMessages: OpenAI.Chat.ChatCompletionMessageParam[] = chatbot.systemPrompt
    ? [{ role: 'system', content: chatbot.systemPrompt }]
    : [];

  const userMessages: OpenAI.Chat.ChatCompletionMessageParam[] = parsed.data.messages.map(
    (m, idx) => {
      const isLastMsg = idx === parsed.data.messages.length - 1;
      const isUserMsg = m.role === 'user';

      if (isLastMsg && isUserMsg && (fileImageBase64 || fileContentText)) {
        if (fileImageBase64 && fileMimeType) {
          // Vision: multimodal content parts
          const text = m.content.trim() || 'Please analyze this image.';
          const contentParts: OpenAI.Chat.ChatCompletionContentPart[] = [
            { type: 'text', text },
            {
              type: 'image_url',
              image_url: {
                url: `data:${fileMimeType};base64,${fileImageBase64}`,
                detail: 'auto',
              },
            },
          ];
          return { role: 'user' as const, content: contentParts };
        } else if (fileContentText) {
          // Text document: inject extracted content before user's question
          const userText = m.content.trim();
          const fileName = file?.originalname || 'file';
          const combined = `[Attached file: ${fileName}]\n\n${fileContentText}${
            userText ? `\n\n---\n${userText}` : ''
          }`;
          return { role: m.role, content: combined };
        }
      }

      return { role: m.role, content: m.content };
    }
  );

  // ── Call OpenAI ──────────────────────────────────────────────────────────
  try {
    const completion = await openai.chat.completions.create({
      model: chatbot.model,
      messages: [...systemMessages, ...userMessages],
      max_tokens: 1500,
      temperature: 0.7,
    }, { timeout: 90_000 }); // 90 s — file-heavy requests can be slow

    const reply = completion.choices[0]?.message;
    if (!reply) throw new ApiError(502, 'No response from OpenAI.');

    sendSuccess(res, {
      message: { role: reply.role, content: reply.content || '' },
      usage: completion.usage,
    });
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    const msg = err?.message || 'OpenAI request failed.';
    throw new ApiError(502, `AI error: ${msg}`);
  }
});
