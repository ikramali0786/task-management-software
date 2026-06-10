/**
 * Client error monitoring (Sentry) — optional and lazy.
 *
 * The SDK is only downloaded when VITE_SENTRY_DSN is set at build time, so
 * the main bundle pays zero cost otherwise. `captureError` queues until the
 * SDK is ready and silently no-ops when monitoring is disabled.
 */
type SentryModule = typeof import('@sentry/react');

let sentry: SentryModule | null = null;
const queue: { error: unknown; context?: Record<string, unknown> }[] = [];

export const initSentry = (): void => {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;

  import('@sentry/react')
    .then((S) => {
      S.init({
        dsn,
        environment: import.meta.env.MODE,
        // Errors are the priority; sample perf lightly.
        tracesSampleRate: 0.1,
        // Network noise that isn't actionable from the client side.
        ignoreErrors: ['Network Error', 'Request aborted', 'Load failed', 'Failed to fetch'],
      });
      sentry = S;
      // Flush anything captured before the SDK finished loading.
      for (const item of queue.splice(0)) captureError(item.error, item.context);
    })
    .catch(() => {
      /* monitoring is best-effort — never break the app over it */
    });
};

export const captureError = (error: unknown, context?: Record<string, unknown>): void => {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  if (!sentry) {
    queue.push({ error, context });
    return;
  }
  sentry.captureException(error, context ? { extra: context } : undefined);
};
