import * as Sentry from "@sentry/nextjs";

/**
 * Server-side (and edge) Sentry init. Runs once per server instance, before
 * the first request is handled.
 *
 * Everything here is a no-op when SENTRY_DSN is unset, which is the case in
 * local dev and CI — so nothing needs stubbing there.
 */
export function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    // Traces are sampled well below 100%: the free tier's quota is small and
    // errors, not spans, are what we actually act on.
    tracesSampleRate: 0.1,
    // Don't ship local noise to the dashboard.
    enabled: process.env.NODE_ENV === "production",
  });
}

/**
 * Forwards server-render and route-handler errors that Next catches itself —
 * these never reach a React error boundary, so without this hook they'd only
 * exist in the Vercel logs.
 */
export const onRequestError = Sentry.captureRequestError;
