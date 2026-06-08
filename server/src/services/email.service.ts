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
  replyTo?: string;
}

const send = async ({ to, subject, html, replyTo }: SendArgs): Promise<void> => {
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
      ...(replyTo ? { replyTo } : {}),
    });
    if (error) throw new Error(error.message);
  } catch (err: any) {
    audit('email.send.failure', { email: to, reason: err?.message || 'unknown', subject });
    // Re-throw so callers can decide whether to surface the failure.
    throw err;
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
 * TaskFlow transactional email design system — "Atelier" ember theme.
 *
 * Mirrors the in-app brand exactly (tailwind.config + globals.css):
 *   • Ember accent  #e8502e → gradient to #f97316 / #fb923c
 *   • Warm paper/ink neutrals (slate ramp re-mapped warm)
 *   • Bricolage Grotesque (display) + Hanken Grotesk (body)
 *
 * Built for real inboxes, not just a browser preview:
 *   • Table-based, inline-styled, 600px column (Outlook/Gmail safe)
 *   • Bulletproof CTA with VML fallback for Outlook (mso)
 *   • Hidden preheader preview text
 *   • prefers-color-scheme dark mode + Outlook.com (ogsc) overrides
 *   • Google Fonts via <link> (Apple Mail / iOS) with system fallbacks
 * ───────────────────────────────────────────────────────────────────────────── */

const C = {
  ember: '#e8502e',
  emberDark: '#c93d1f',
  emberSoft: '#fff3ee',
  emberBorder: '#ffd9c8',
  ink: '#211e19', // slate-900
  ink2: '#312d26', // slate-800
  body: '#49433a', // slate-700
  muted: '#837a6b', // slate-500
  faint: '#a89f8f', // slate-400
  border: '#e7e1d7', // slate-200
  borderSoft: '#f3f0ea', // slate-100
  paper: '#faf8f4', // slate-50
  white: '#ffffff',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
} as const;

const FONT_BODY =
  "'Hanken Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const FONT_DISPLAY =
  "'Bricolage Grotesque', 'Hanken Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const APP_URL = env.CLIENT_URL || 'https://taskflow.app';

const esc = (s: string): string =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Hidden preview text shown in the inbox list, before the body is opened.
const preheader = (text: string): string => `
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.paper};opacity:0;">
    ${esc(text)}
    ${'&#847;&zwnj;&nbsp;'.repeat(60)}
  </div>`;

// Bulletproof CTA — VML for Outlook, padded anchor everywhere else.
const button = (label: string, url: string): string => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px;">
    <tr>
      <td align="center" bgcolor="${C.ember}" style="border-radius:12px;">
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
          href="${url}" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="25%"
          strokecolor="${C.emberDark}" fillcolor="${C.ember}">
          <w:anchorlock/>
          <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">${esc(label)}</center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-- -->
        <a href="${url}" target="_blank"
          style="display:inline-block;background:${C.ember};background-image:linear-gradient(135deg,#e8502e 0%,#f97316 100%);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:12px;font-family:${FONT_BODY};font-size:15px;font-weight:700;letter-spacing:-0.2px;box-shadow:0 6px 18px rgba(232,80,46,0.32);">
          ${esc(label)}
        </a>
        <!--<![endif]-->
      </td>
    </tr>
  </table>`;

const linkFallback = (url: string): string => `
  <p class="muted" style="margin:18px 0 0;font-family:${FONT_BODY};font-size:13px;line-height:1.5;color:${C.muted};">
    Button not working? Paste this link into your browser:<br/>
    <a href="${url}" target="_blank" style="color:${C.ember};text-decoration:underline;word-break:break-all;">${esc(url)}</a>
  </p>`;

// Warm inset "detail card" used for invites / reminders.
const detailPanel = (rows: string): string => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="panel"
    style="margin:8px 0 4px;background:${C.paper};border:1px solid ${C.border};border-radius:14px;">
    <tr><td style="padding:18px 20px;">${rows}</td></tr>
  </table>`;

const panelRow = (label: string, value: string): string => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr>
      <td style="padding:5px 0;font-family:${FONT_BODY};font-size:12px;font-weight:600;letter-spacing:0.4px;text-transform:uppercase;color:${C.faint};white-space:nowrap;width:90px;vertical-align:top;">${label}</td>
      <td class="ink" style="padding:5px 0;font-family:${FONT_BODY};font-size:15px;font-weight:600;color:${C.ink};">${value}</td>
    </tr>
  </table>`;

interface RenderArgs {
  preview: string; // inbox preview text
  eyebrow?: string; // small uppercase label above the heading
  heading: string;
  intro: string; // lead paragraph(s) HTML
  panel?: string; // optional detail card HTML
  cta?: { label: string; url: string };
  outro?: string; // optional paragraph(s) below CTA
  footerNote?: string; // contextual footer note (defaults to a generic one)
}

const renderEmail = ({
  preview,
  eyebrow,
  heading,
  intro,
  panel,
  cta,
  outro,
  footerNote,
}: RenderArgs): string => `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>TaskFlow</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings xmlns:o="urn:schemas-microsoft-com:office:office">
    <o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600..800&family=Hanken+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    body { margin:0; padding:0; width:100% !important; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table { border-collapse:collapse; }
    img { border:0; line-height:100%; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
    a { text-decoration:none; }
    @media only screen and (max-width:600px) {
      .container { width:100% !important; }
      .px { padding-left:24px !important; padding-right:24px !important; }
    }
    @media (prefers-color-scheme: dark) {
      .email-bg { background:#141210 !important; }
      .card { background:#211e19 !important; border-color:#312d26 !important; }
      .h1 { color:#f3f0ea !important; }
      .text { color:#d4ccbe !important; }
      .muted { color:#a89f8f !important; }
      .panel { background:#312d26 !important; border-color:#49433a !important; }
      .footer { color:#837a6b !important; }
      .divider { border-color:#312d26 !important; }
      .ink { color:#f3f0ea !important; }
    }
    [data-ogsc] .email-bg { background:#141210 !important; }
    [data-ogsc] .card { background:#211e19 !important; border-color:#312d26 !important; }
    [data-ogsc] .h1 { color:#f3f0ea !important; }
    [data-ogsc] .text { color:#d4ccbe !important; }
    [data-ogsc] .muted { color:#a89f8f !important; }
    [data-ogsc] .panel { background:#312d26 !important; border-color:#49433a !important; }
    [data-ogsc] .ink { color:#f3f0ea !important; }
  </style>
</head>
<body class="email-bg" style="margin:0;padding:0;background:${C.paper};">
  ${preheader(preview)}
  <table role="presentation" class="email-bg" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.paper};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" class="container" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;">

          <!-- Brand lockup -->
          <tr>
            <td style="padding:0 4px 22px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                      <td width="40" height="40" align="center" valign="middle"
                        style="width:40px;height:40px;border-radius:11px;background:${C.ember};background-image:linear-gradient(135deg,#e8502e 0%,#f97316 55%,#fb923c 100%);box-shadow:0 6px 16px rgba(232,80,46,0.30);">
                        <span style="font-family:${FONT_DISPLAY};font-size:22px;font-weight:800;color:#ffffff;line-height:40px;">&#9889;</span>
                      </td>
                    </tr></table>
                  </td>
                  <td style="vertical-align:middle;padding-left:12px;">
                    <span class="h1" style="font-family:${FONT_DISPLAY};font-size:22px;font-weight:800;letter-spacing:-0.6px;color:${C.ink};">TaskFlow</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td class="card" style="background:${C.white};border:1px solid ${C.border};border-radius:18px;box-shadow:0 1px 2px rgba(33,30,25,0.04),0 12px 40px rgba(33,30,25,0.07);overflow:hidden;">
              <!-- Ember top accent bar -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr><td height="4" style="height:4px;font-size:0;line-height:0;background:${C.ember};background-image:linear-gradient(90deg,#e8502e 0%,#f97316 50%,#fb923c 100%);">&nbsp;</td></tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td class="px" style="padding:36px 40px 38px;">
                    ${
                      eyebrow
                        ? `<p style="margin:0 0 10px;font-family:${FONT_BODY};font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${C.ember};">${esc(eyebrow)}</p>`
                        : ''
                    }
                    <h1 class="h1" style="margin:0 0 16px;font-family:${FONT_DISPLAY};font-size:26px;font-weight:800;letter-spacing:-0.7px;line-height:1.2;color:${C.ink};">${heading}</h1>
                    <div class="text" style="font-family:${FONT_BODY};font-size:15.5px;line-height:1.65;color:${C.body};">
                      ${intro}
                    </div>
                    ${panel ? panel : ''}
                    ${cta ? button(cta.label, cta.url) : ''}
                    ${cta ? linkFallback(cta.url) : ''}
                    ${
                      outro
                        ? `<div class="text" style="font-family:${FONT_BODY};font-size:15.5px;line-height:1.65;color:${C.body};margin-top:8px;">${outro}</div>`
                        : ''
                    }
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:26px 28px 8px;">
              <p class="footer" style="margin:0 0 6px;font-family:${FONT_BODY};font-size:13px;line-height:1.6;color:${C.muted};">
                ${esc(footerNote || "You're receiving this because this email is tied to a TaskFlow account. If it wasn't you, you can safely ignore this message.")}
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr><td class="divider" style="border-top:1px solid ${C.border};font-size:0;line-height:0;padding-top:16px;">&nbsp;</td></tr>
              </table>
              <p class="footer" style="margin:12px 0 0;font-family:${FONT_BODY};font-size:12px;line-height:1.5;color:${C.faint};">
                <a href="${APP_URL}" target="_blank" style="color:${C.muted};font-weight:600;text-decoration:none;">TaskFlow</a>
                &nbsp;·&nbsp; Manage your team's work with clarity.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// ── Templated senders ──────────────────────────────────────────────────────
export const sendPasswordResetEmail = async (
  to: string,
  name: string,
  resetUrl: string
): Promise<void> => {
  await send({
    to,
    subject: 'Reset your TaskFlow password',
    html: renderEmail({
      preview: 'Reset your TaskFlow password — this link expires in 1 hour.',
      eyebrow: 'Account security',
      heading: `Reset your password`,
      intro: `<p style="margin:0 0 12px;">Hi ${esc(name)}, we received a request to reset the password for your TaskFlow account. Choose a new one using the button below — this link expires in <strong class="ink" style="color:${C.ink};">1 hour</strong>.</p>
        <p style="margin:0;">If you didn't request this, no action is needed and your password stays exactly the same.</p>`,
      cta: { label: 'Reset password', url: resetUrl },
      footerNote:
        'For your security, never share this link. TaskFlow will never ask for your password by email.',
    }),
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
    html: renderEmail({
      preview: 'Confirm your email to finish setting up your TaskFlow account.',
      eyebrow: 'Welcome aboard',
      heading: `Welcome, ${esc(name)} 👋`,
      intro: `<p style="margin:0 0 12px;">You're one step away from a clearer workflow. Confirm your email address to secure your TaskFlow account and unlock boards, teams and real-time collaboration.</p>
        <p style="margin:0;">This verification link expires in <strong class="ink" style="color:${C.ink};">24 hours</strong>.</p>`,
      cta: { label: 'Verify email', url: verifyUrl },
      footerNote:
        "If you didn't create a TaskFlow account, you can safely ignore this email.",
    }),
  });
};

// A numbered "getting started" step inside the welcome panel.
const stepRow = (n: number, title: string, body: string, last = false): string => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
    style="${last ? '' : `border-bottom:1px solid ${C.border};`}">
    <tr>
      <td width="36" valign="top" style="padding:14px 14px 14px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr><td width="32" height="32" align="center" valign="middle"
            style="width:32px;height:32px;border-radius:9px;background:${C.emberSoft};font-family:${FONT_DISPLAY};font-size:15px;font-weight:800;color:${C.ember};line-height:32px;">${n}</td></tr>
        </table>
      </td>
      <td valign="top" style="padding:14px 0;">
        <div class="ink" style="font-family:${FONT_BODY};font-size:15px;font-weight:700;color:${C.ink};">${title}</div>
        <div class="muted" style="font-family:${FONT_BODY};font-size:13.5px;line-height:1.55;color:${C.muted};margin-top:2px;">${body}</div>
      </td>
    </tr>
  </table>`;

export const sendWelcomeEmail = async (to: string, name: string): Promise<void> => {
  const appUrl = APP_URL.replace(/\/$/, '');
  const firstName = esc(name.trim().split(/\s+/)[0] || name);
  await send({
    to,
    subject: 'Welcome to TaskFlow 🎉',
    html: renderEmail({
      preview: `You're all set, ${firstName}. Here's how to get the most out of TaskFlow.`,
      eyebrow: "You're verified",
      heading: `Welcome aboard, ${firstName} 🎉`,
      intro: `<p style="margin:0 0 4px;">Your email is confirmed and your workspace is ready. TaskFlow gives your team visual Kanban boards, real-time collaboration, subtask checklists and AI-powered chatbots — all in one place.</p>`,
      panel: detailPanel(
        stepRow(1, 'Create your first team', 'Spin up a workspace and invite teammates with a single shareable code.') +
          stepRow(2, 'Build a board', 'Add tasks, drag them across columns, and watch updates sync live for everyone.') +
          stepRow(3, 'Try an AI chatbot', 'Connect an OpenAI key and let an assistant draft, summarise and plan your work.', true)
      ),
      cta: { label: 'Open your workspace', url: appUrl },
      outro: `<p style="margin:0;">Need a hand getting started? Just reply to this email — we're happy to help.</p>`,
      footerNote:
        "You're receiving this because you just verified your TaskFlow account. Welcome to the team!",
    }),
  });
};

export const sendDueReminderEmail = async (
  to: string,
  name: string,
  taskTitle: string,
  teamName: string,
  dueLabel: string,
  taskUrl: string,
  overdue = false
): Promise<void> => {
  const statusValue = overdue
    ? `<span style="color:${C.danger};font-weight:700;">Overdue</span>`
    : `Due ${esc(dueLabel)}`;

  await send({
    to,
    subject: overdue
      ? `⚠️ Overdue: "${taskTitle}" on TaskFlow`
      : `Due ${dueLabel}: "${taskTitle}" on TaskFlow`,
    html: renderEmail({
      preview: overdue
        ? `"${taskTitle}" in ${teamName} is overdue.`
        : `"${taskTitle}" in ${teamName} is due ${dueLabel}.`,
      eyebrow: overdue ? 'Task overdue' : 'Task reminder',
      heading: overdue ? 'A task needs your attention' : 'You have a task due soon',
      intro: `<p style="margin:0 0 14px;">Hi ${esc(name)}, here's a quick heads-up on a task assigned to you${
        overdue ? ' that has slipped past its due date' : ''
      }.</p>`,
      panel: detailPanel(
        panelRow('Task', esc(taskTitle)) + panelRow('Team', esc(teamName)) + panelRow('Status', statusValue)
      ),
      cta: { label: 'View task', url: taskUrl },
      outro: `<p style="margin:0;">Open it in TaskFlow to update its status, reassign it, or adjust the due date.</p>`,
      footerNote:
        "You're receiving this because you're assigned to this task. Manage reminder preferences in your TaskFlow settings.",
    }),
  });
};

export const sendTeamInviteEmail = async (
  to: string,
  inviterName: string,
  teamName: string,
  inviteUrl: string
): Promise<void> => {
  const initial = (teamName.trim()[0] || 'T').toUpperCase();
  const teamBadge = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td width="44" height="44" align="center" valign="middle"
          style="width:44px;height:44px;border-radius:12px;background:${C.ember};background-image:linear-gradient(135deg,#e8502e 0%,#f97316 55%,#fb923c 100%);font-family:${FONT_DISPLAY};font-size:20px;font-weight:800;color:#ffffff;line-height:44px;">${esc(initial)}</td>
        <td style="padding-left:14px;vertical-align:middle;">
          <div class="text" style="font-family:${FONT_DISPLAY};font-size:18px;font-weight:800;letter-spacing:-0.4px;color:${C.ink};">${esc(teamName)}</div>
          <div class="muted" style="font-family:${FONT_BODY};font-size:13px;color:${C.muted};margin-top:2px;">Invited by ${esc(inviterName)}</div>
        </td>
      </tr>
    </table>`;

  await send({
    to,
    subject: `${inviterName} invited you to ${teamName} on TaskFlow`,
    html: renderEmail({
      preview: `${inviterName} invited you to collaborate on ${teamName} in TaskFlow.`,
      eyebrow: 'Team invitation',
      heading: `You've been invited to collaborate`,
      intro: `<p style="margin:0 0 16px;"><strong class="ink" style="color:${C.ink};">${esc(inviterName)}</strong> has invited you to join their team on TaskFlow — visual boards, real-time updates and everything your team needs to ship together.</p>`,
      panel: detailPanel(teamBadge),
      cta: { label: 'Join the team', url: inviteUrl },
      outro: `<p style="margin:0;">New to TaskFlow? You'll be able to create your account in a moment — it's free to get started.</p>`,
      footerNote:
        "If you weren't expecting this invitation, you can safely ignore this email — no account will be created.",
    }),
  });
};

export const sendTaskAssignedEmail = async (
  to: string,
  name: string,
  opts: { taskTitle: string; teamName: string; assignedBy: string; url: string }
): Promise<void> => {
  await send({
    to,
    subject: `${opts.assignedBy} assigned you a task: "${opts.taskTitle}"`,
    html: renderEmail({
      preview: `${opts.assignedBy} assigned you "${opts.taskTitle}" in ${opts.teamName}.`,
      eyebrow: 'Task assigned',
      heading: 'You have a new task',
      intro: `<p style="margin:0 0 14px;">Hi ${esc(name)}, <strong class="ink" style="color:${C.ink};">${esc(opts.assignedBy)}</strong> assigned a task to you on TaskFlow.</p>`,
      panel: detailPanel(panelRow('Task', esc(opts.taskTitle)) + panelRow('Team', esc(opts.teamName))),
      cta: { label: 'View task', url: opts.url },
      outro: `<p style="margin:0;">Open TaskFlow to see the details, add subtasks, or start working.</p>`,
      footerNote:
        "You're receiving this because you were assigned a task. Manage email notifications in your TaskFlow settings.",
    }),
  });
};

export const sendMentionEmail = async (
  to: string,
  name: string,
  opts: { taskTitle: string; teamName: string; byName: string; url: string }
): Promise<void> => {
  await send({
    to,
    subject: `${opts.byName} mentioned you on "${opts.taskTitle}"`,
    html: renderEmail({
      preview: `${opts.byName} mentioned you in a comment on "${opts.taskTitle}".`,
      eyebrow: 'You were mentioned',
      heading: `${esc(opts.byName)} mentioned you`,
      intro: `<p style="margin:0 0 14px;">Hi ${esc(name)}, <strong class="ink" style="color:${C.ink};">${esc(opts.byName)}</strong> mentioned you in a comment on a task in <strong class="ink" style="color:${C.ink};">${esc(opts.teamName)}</strong>.</p>`,
      panel: detailPanel(panelRow('Task', esc(opts.taskTitle)) + panelRow('Team', esc(opts.teamName))),
      cta: { label: 'View the conversation', url: opts.url },
      footerNote:
        "You're receiving this because you were mentioned. Manage email notifications in your TaskFlow settings.",
    }),
  });
};

/** Support contact form → support inbox. Reply-To is set to the submitter. */
export const sendSupportEmail = async (opts: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): Promise<void> => {
  await send({
    to: env.SUPPORT_EMAIL,
    replyTo: opts.email,
    subject: `[Support] ${opts.subject}`,
    html: renderEmail({
      preview: `New support message from ${opts.name}`,
      eyebrow: 'Support request',
      heading: 'New support message',
      intro: `<p style="margin:0 0 14px;">From <strong class="ink" style="color:${C.ink};">${esc(opts.name)}</strong> &lt;${esc(opts.email)}&gt;</p><p style="margin:0;white-space:pre-wrap;">${esc(opts.message)}</p>`,
      panel: detailPanel(panelRow('Subject', esc(opts.subject)) + panelRow('From', esc(opts.email))),
      footerNote: 'Reply directly to this email to respond to the sender.',
    }),
  });
};
