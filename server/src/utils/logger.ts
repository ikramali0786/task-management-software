import winston from 'winston';

// ── Base logger ───────────────────────────────────────────────────────────────

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production'
        ? winston.format.json()
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const extras = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
              return `${timestamp} [${level}] ${message}${extras}`;
            }),
          ),
    }),
  ],
});

export default logger;

// ── Security audit log ────────────────────────────────────────────────────────
// All security-relevant events write a structured JSON log line.
// Never log passwords, tokens, or full request bodies.

export type AuditEvent =
  | 'auth.register'
  | 'auth.login.success'
  | 'auth.login.failure'
  | 'auth.login.locked'
  | 'auth.logout'
  | 'auth.token.refresh'
  | 'auth.token.reuse'
  | 'auth.password.changed'
  | 'auth.password.forgot'
  | 'auth.password.reset'
  | 'auth.email.verify.sent'
  | 'auth.email.verify.success'
  | 'email.send.failure'
  | 'file.upload.blocked';

export interface AuditPayload {
  ip?:      string;
  userId?:  string;
  email?:   string;
  reason?:  string;
  filename?: string;
  mimetype?: string;
  [key: string]: unknown;
}

export const audit = (event: AuditEvent, payload: AuditPayload = {}): void => {
  logger.info({ audit: true, event, ...payload });
};
