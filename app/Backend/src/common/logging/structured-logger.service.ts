import { ConsoleLogger, LogLevel } from '@nestjs/common';
import { getRequestId } from './request-context';

const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE_PATTERN = /\+?\d[\d\s-]{7,}\d/g;

/**
 * Best-effort PII scrub for log messages (nfr.md §7 — "no PII in logs").
 * Pattern-based, not a full DLP solution: catches emails/phone-shaped
 * substrings in string messages, which covers every current log call site.
 */
function redact(message: unknown): unknown {
  if (typeof message !== 'string') {
    return message;
  }
  return message
    .replace(EMAIL_PATTERN, '[REDACTED_EMAIL]')
    .replace(PHONE_PATTERN, '[REDACTED_PHONE]');
}

/**
 * JSON-line logger (nfr.md §7: structured logs + request_id correlation
 * across API → queue jobs). Built on Nest's own `json` ConsoleLogger mode
 * (`getJsonLogObject` is its structured-output hook) rather than a
 * from-scratch formatter, so framework log calls keep working unchanged.
 */
export class StructuredLoggerService extends ConsoleLogger {
  constructor() {
    super({ json: true });
  }

  protected getJsonLogObject(
    message: unknown,
    options: {
      context: string;
      logLevel: LogLevel;
      writeStreamType?: 'stdout' | 'stderr';
      errorStack?: unknown;
    },
  ) {
    return {
      level: options.logLevel,
      pid: process.pid,
      timestamp: Date.now(),
      context: options.context || undefined,
      message: redact(message),
      request_id: getRequestId(),
      ...(options.errorStack ? { stack: options.errorStack } : {}),
    };
  }
}
