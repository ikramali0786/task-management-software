import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { sanitizeText } from '../utils/sanitize';
import { sendSupportEmail, isEmailConfigured } from '../services/email.service';
import logger from '../utils/logger';

/* POST /api/support/contact — public contact form → support inbox. */
export const submitContact = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    name: z.string().min(1).max(100),
    email: z.string().email(),
    subject: z.string().min(1).max(150),
    message: z.string().min(10).max(5000),
    company: z.string().optional(), // honeypot
  });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) throw new ApiError(400, parsed.error.errors[0].message);

  // Honeypot: real users never fill this hidden field. Pretend success for bots.
  if (parsed.data.company && parsed.data.company.trim() !== '') {
    return sendSuccess(res, null, 'Thanks — your message has been sent.');
  }

  const payload = {
    name: sanitizeText(parsed.data.name),
    email: parsed.data.email.trim(),
    subject: sanitizeText(parsed.data.subject),
    message: sanitizeText(parsed.data.message),
  };

  if (!isEmailConfigured()) {
    // Don't fail the user — log it so it isn't lost when email isn't set up.
    logger.warn(`[support] contact (email not configured) from ${payload.email}: ${payload.subject}`);
    return sendSuccess(res, null, "Thanks — we've received your message and will get back to you.");
  }

  try {
    await sendSupportEmail(payload);
  } catch (err: any) {
    logger.error(`[support] failed to send contact email: ${err?.message}`);
    throw new ApiError(502, 'We couldn’t send your message right now. Please email us directly.');
  }

  sendSuccess(res, null, "Thanks — we've received your message and will get back to you.");
});
