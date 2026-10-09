/**
 * Best-effort PII scrub (nfr.md §7 — "no PII in logs"), shared by the JSON
 * logger and Sentry's beforeSend. Pattern-based, not a full DLP solution:
 * catches emails/phone-shaped substrings, which covers every current log and
 * error-message call site.
 *
 * Deliberately import-free: instrument.ts loads it before Sentry has patched
 * anything, so it must not pull in Nest or any instrumented library.
 */
const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE_PATTERN = /\+?\d[\d\s-]{7,}\d/g;

export function redact<T>(message: T): T {
  if (typeof message !== 'string') {
    return message;
  }
  return message
    .replace(EMAIL_PATTERN, '[REDACTED_EMAIL]')
    .replace(PHONE_PATTERN, '[REDACTED_PHONE]') as T;
}
