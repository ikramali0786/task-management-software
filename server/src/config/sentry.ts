import * as Sentry from '@sentry/node';
import { env } from './env';

/**
 * Error monitoring (Sentry) — optional, like every external service here.
 * When SENTRY_DSN is unset the app runs exactly as before: init is a no-op
 * and captureError falls through silently. Set SENTRY_DSN on Render to turn
 * production error reporting on without a code change.
 */
let enabled = false;

export const initSentry = (): void => {
  if (!env.SENTRY_DSN) return;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    // Keep tracing cheap — errors are the priority, perf is a sample.
    tracesSampleRate: 0.1,
    // Don't report expected operational noise.
    ignoreErrors: ['TokenExpiredError', 'JsonWebTokenError'],
  });
  enabled = true;
};

export const isSentryEnabled = (): boolean => enabled;

/** Report an unexpected error with optional request context. No-op without a DSN. */
export const captureError = (
  err: unknown,
  context?: { path?: string; method?: string; userId?: string }
): void => {
  if (!enabled) return;
  Sentry.captureException(err, (scope) => {
    if (context?.path) scope.setTag('path', context.path);
    if (context?.method) scope.setTag('method', context.method);
    if (context?.userId) scope.setUser({ id: context.userId });
    return scope;
  });
};
