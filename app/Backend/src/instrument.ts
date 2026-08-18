import * as Sentry from '@sentry/nestjs';

/**
 * Sentry initialisation.
 *
 * This module has to be imported before anything else in main.ts — Sentry's
 * auto-instrumentation patches libraries (http, express, pg, ioredis) as they
 * are first required, so any import that beats it here silently loses its
 * tracing.
 *
 * No DSN (local dev, CI, tests) makes every Sentry call a no-op, so nothing
 * downstream needs to branch on whether it's configured.
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  // Errors are the signal we act on; traces are sampled low to stay inside
  // the free tier's event quota.
  tracesSampleRate: 0.1,
  // Never ship request bodies: they carry passenger PII and payment payloads.
  sendDefaultPii: false,
  beforeSend(event) {
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
      if (event.request.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
    }
    return event;
  },
});
