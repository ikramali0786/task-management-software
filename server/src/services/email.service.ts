import { Resend } from 'resend';
import { env } from '../config/env';
import logger, { audit } from '../utils/logger';

// ── Resend client ──────────────────────────────────────────────────────────
// Lazily instantiated so the app boots even when no key is configured (dev).
// All send* helpers no-op (and log a warning) when RESEND_API_KEY is unset,
// so the auth flows still work end-to-end locally without an email provider.

let resend: Resend | null = null;
const getClient = (): Resend | null => {
  if (!env.RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(env.RESEND_API_KEY);
  return resend;
};

export const isEmailConfigured = (): boolean => Boolean(env.RESEND_API_KEY);

interface SendArgs {
  to: string;
  subject: string;
  html: string;
}

const send = async ({ to, subject, html }: SendArgs): Promise<void> => {
  const client = getClient();
  if (!client) {
    logger.warn(
      `[email] RESEND_API_KEY not set — skipping "${subject}" to ${to}. ` +
        'Configure RESEND_API_KEY + EMAIL_FROM to enable transactional email.'
    );
    return;
  }

  try {
    const { error } = await client.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject,
      html,
    });
    if (error) throw new Error(error.message);
  } catch (err: any) {
    audit('email.send.failure', { email: to, reason: err?.message || 'unknown', subject });
    // Re-throw so callers can decide whether to surface the failure.
    throw err;
  }
};

// ── Shared HTML shell ──────────────────────────────────────────────────────
const layout = (heading: string, body: string, cta?: { label: string; url: string }): string => `
  <div style="background:#f4f5f7;padding:32px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:#4f46e5;padding:20px 28px;">
        <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">TaskFlow</span>
      </div>
      <div style="padding:28px;">
        <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">${heading}</h1>
        <div style="font-size:15px;line-height:1.6;color:#374151;">${body}</div>
        ${
          cta
            ? `<div style="margin:28px 0 8px;">
                 <a href="${cta.url}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:600;">${cta.label}</a>
               </div>
               <p style="font-size:13px;color:#6b7280;margin:16px 0 0;word-break:break-all;">
                 Or paste this link into your browser:<br/>
                 <a href="${cta.url}" style="color:#4f46e5;">${cta.url}</a>
               </p>`
            : ''
        }
      </div>
      <div style="padding:18px 28px;border-top:1px solid #f3f4f6;">
        <p style="margin:0;font-size:12px;color:#9ca3af;">
          You're receiving this because someone used this address on TaskFlow. If this wasn't you, you can safely ignore this email.
        </p>
      </div>
    </div>
  </div>
`;

// ── Templated senders ──────────────────────────────────────────────────────
export const sendPasswordResetEmail = async (
  to: string,
  name: string,
  resetUrl: string
): Promise<void> => {
  await send({
    to,
    subject: 'Reset your TaskFlow password',
    html: layout(
      `Hi ${name},`,
      `<p style="margin:0 0 12px;">We received a request to reset your TaskFlow password. Click the button below to choose a new one. This link expires in <strong>1 hour</strong>.</p>
       <p style="margin:0;">If you didn't request this, no action is needed — your password stays the same.</p>`,
      { label: 'Reset password', url: resetUrl }
    ),
  });
};

export const sendVerificationEmail = async (
  to: string,
  name: string,
  verifyUrl: string
): Promise<void> => {
  await send({
    to,
    subject: 'Verify your TaskFlow email',
    html: layout(
      `Welcome, ${name}!`,
      `<p style="margin:0 0 12px;">Confirm your email address to secure your TaskFlow account. This link expires in <strong>24 hours</strong>.</p>`,
      { label: 'Verify email', url: verifyUrl }
    ),
  });
};

export const sendTeamInviteEmail = async (
  to: string,
  inviterName: string,
  teamName: string,
  inviteUrl: string
): Promise<void> => {
  await send({
    to,
    subject: `${inviterName} invited you to ${teamName} on TaskFlow`,
    html: layout(
      `You've been invited to ${teamName}`,
      `<p style="margin:0 0 12px;"><strong>${inviterName}</strong> has invited you to collaborate on the <strong>${teamName}</strong> team in TaskFlow.</p>
       <p style="margin:0;">Click below to join. If you don't have an account yet, you'll be able to create one.</p>`,
      { label: 'Join team', url: inviteUrl }
    ),
  });
};
