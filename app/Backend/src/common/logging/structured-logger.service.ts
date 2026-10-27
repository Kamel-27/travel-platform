import { ConsoleLogger, LogLevel } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { getRequestId } from './request-context';
import { redact } from './redact';

/**
 * Sentry groups by fingerprint; without one, every "Refund <uuid> failed"
 * would open its own issue. Ids and numbers are collapsed so one failure mode
 * is one issue, however many bookings it hits.
 */
function fingerprintOf(text: string): string {
  return text
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      '<uuid>',
    )
    .replace(/\b[a-z]+_[A-Za-z0-9]{6,}\b/g, '<id>')
    .replace(/\d+/g, '<n>')
    .slice(0, 200);
}

/**
 * Rebuilds an Error from a logged stack string (`logger.error(msg, err.stack)`
 * is the house pattern) so Sentry parses real frames and groups by them,
 * instead of lumping every crash under one log message.
 */
function errorFromStack(stack: string, fallbackMessage: string): Error {
  const match = /^(\w+): (.*)$/.exec(stack.split('\n', 1)[0]);
  const error = new Error(match ? match[2] : fallbackMessage);
  if (match) error.name = match[1];
  error.stack = stack;
  return error;
}

/**
 * Forwards an error-level log line to Sentry. Every genuine failure in this
 * codebase is logged at error level — HTTP 5xx (GlobalExceptionFilter), and
 * the BullMQ processors, cron sweeps and webhook handlers that never pass
 * through any HTTP filter — so this one hook covers all of them. A no-op
 * when Sentry has no DSN.
 */
function reportToSentry(message: unknown, params: unknown[]): void {
  // Nest's Logger appends its context as the last param; the first may be
  // an Error object or a pre-rendered stack string.
  const last = params[params.length - 1];
  const context =
    params.length > 1 && typeof last === 'string' ? last : undefined;
  const stack =
    typeof params[0] === 'string' && params[0] !== context
      ? params[0]
      : undefined;
  const text = redact(
    typeof message === 'string'
      ? message
      : message instanceof Error
        ? message.message
        : JSON.stringify(message),
  );
  const error =
    message instanceof Error
      ? message
      : (params.find((p): p is Error => p instanceof Error) ??
        (stack && /\n\s+at /.test(stack)
          ? errorFromStack(stack, text)
          : undefined));

  Sentry.withScope((scope) => {
    scope.setLevel('error');
    if (context) scope.setTag('context', context);
    const requestId = getRequestId();
    if (requestId) scope.setTag('requestId', requestId);

    if (error) {
      // Grouped by Sentry's own stack-based grouping.
      scope.setExtra('log_message', text);
      Sentry.captureException(error);
    } else {
      scope.setFingerprint([context ?? 'app', fingerprintOf(text)]);
      if (stack) scope.setExtra('detail', redact(stack));
      Sentry.captureMessage(text);
    }
  });
}

/**
 * The app logger (nfr.md §7: structured logs + request_id correlation across
 * API → queue jobs). In production it writes JSON lines via Nest's own `json`
 * ConsoleLogger mode (`getJsonLogObject` is its structured-output hook);
 * elsewhere it keeps Nest's pretty output. Either way, error-level lines are
 * also reported to Sentry.
 */
export class StructuredLoggerService extends ConsoleLogger {
  constructor(options: { json?: boolean } = {}) {
    super({ json: options.json ?? true });
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    super.error(message, ...optionalParams);
    reportToSentry(message, optionalParams);
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
