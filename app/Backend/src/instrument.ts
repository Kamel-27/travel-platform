import * as Sentry from '@sentry/nestjs';
import { redact } from './common/logging/redact';

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
  // `||`, not `??`: .env.example ships SENTRY_ENVIRONMENT= (empty), which
  // must fall back rather than tag every event with environment "".
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  // Errors only — no tracesSampleRate, so no per-request/per-query spans.
  // The VM has 842MB shared with Postgres, Redis and Caddy, and nobody reads
  // performance traces here.
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
    // Error messages can embed customer emails/phones (e.g. a Duffel
    // validation echo) — same scrub the JSON logs get.
    event.message = redact(event.message);
    for (const value of event.exception?.values ?? []) {
      value.value = redact(value.value);
    }
    return event;
  },
});
