import dotenv from 'dotenv';
dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/taskflow',
  JWT_SECRET: process.env.JWT_SECRET || 'dev_jwt_secret_change_in_prod',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_change_in_prod',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1h',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',

  // ── Cloudflare R2 (S3-compatible object storage) ─────────────────────────
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID || '',
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME || 'taskflow',
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || '',
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || '',
  // Public base URL for the bucket — found in Cloudflare dashboard under
  // R2 → taskflow bucket → Settings → Public Access (e.g. https://pub-XXXX.r2.dev)
  R2_PUBLIC_URL: process.env.R2_PUBLIC_URL || '',

  // ── Email (Resend) ───────────────────────────────────────────────────────
  // RESEND_API_KEY — from https://resend.com/api-keys
  // EMAIL_FROM — verified sender, e.g. "TaskFlow <no-reply@yourdomain.com>".
  //   Until a custom domain is verified, Resend allows "onboarding@resend.dev".
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'TaskFlow <onboarding@resend.dev>',
};
