import * as Sentry from "@sentry/nextjs";

/**
 * Browser-side Sentry init. Runs before the app becomes interactive.
 *
 * No-op without a DSN (local dev, CI). The DSN is deliberately a
 * NEXT_PUBLIC_ var — Sentry DSNs are public by design, they only permit
 * writing events, and the browser bundle has to carry it regardless.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    enabled: process.env.NODE_ENV === "production",
    // Session Replay is off: it records customer PII (passenger names, card
    // form fields) and this app has no consent flow covering that.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}

// Lets Sentry tie a captured error to the navigation that triggered it.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
