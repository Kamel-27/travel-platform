/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { StructuredLoggerService } from './structured-logger.service';
import * as Sentry from '@sentry/nestjs';
import { runWithRequestId } from './request-context';

const mockScope = {
  setLevel: jest.fn(),
  setTag: jest.fn(),
  setFingerprint: jest.fn(),
  setExtra: jest.fn(),
};
jest.mock('@sentry/nestjs', () => ({
  withScope: jest.fn((cb: (scope: unknown) => unknown) => cb(mockScope)),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

describe('StructuredLoggerService', () => {
  let logger: StructuredLoggerService;
  let writeSpy: jest.SpyInstance;

  beforeEach(() => {
    logger = new StructuredLoggerService();
    writeSpy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  function lastLine(): Record<string, unknown> {
    const raw = writeSpy.mock.calls[
      writeSpy.mock.calls.length - 1
    ][0] as string;
    return JSON.parse(raw) as Record<string, unknown>;
  }

  it('emits a JSON line with level, message, and context', () => {
    logger.log('hello world', 'MyContext');

    const line = lastLine();
    expect(line.level).toBe('log');
    expect(line.message).toBe('hello world');
    expect(line.context).toBe('MyContext');
    expect(typeof line.timestamp).toBe('number');
  });

  it('attaches the current request id from ALS', () => {
    runWithRequestId('req-789', () => {
      logger.log('inside a request');
    });

    expect(lastLine().request_id).toBe('req-789');
  });

  it('omits request_id outside any request context', () => {
    logger.log('background job log');
    expect(lastLine().request_id).toBeUndefined();
  });

  it('redacts email-shaped substrings in the message', () => {
    logger.log('Magic link for user@example.com:');
    expect(lastLine().message).toBe('Magic link for [REDACTED_EMAIL]:');
  });

  it('redacts phone-shaped substrings in the message', () => {
    logger.log('Contact number +20 100 123 4567 on file');
    expect(lastLine().message as string).toContain('[REDACTED_PHONE]');
  });
});

describe('StructuredLoggerService → Sentry', () => {
  let logger: StructuredLoggerService;
  const captureException = Sentry.captureException as jest.Mock;
  const captureMessage = Sentry.captureMessage as jest.Mock;
  const scope = mockScope;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = new StructuredLoggerService();
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports a logged Error object as an exception, tagged with its context', () => {
    const err = new Error('refund gateway down');

    logger.error('Refund failed', err, 'RefundExecutionProcessor');

    expect(captureException).toHaveBeenCalledWith(err);
    expect(scope.setTag).toHaveBeenCalledWith(
      'context',
      'RefundExecutionProcessor',
    );
  });

  it('rebuilds an Error from a logged stack string so Sentry groups by frames', () => {
    const stack =
      'TypeError: Cannot read properties of undefined\n    at fulfillOrder (/app/dist/x.js:10:5)';

    logger.error('Unhandled exception', stack, 'GlobalExceptionFilter');

    const reported = captureException.mock.calls[0][0] as Error;
    expect(reported.name).toBe('TypeError');
    expect(reported.message).toBe('Cannot read properties of undefined');
    expect(reported.stack).toBe(stack);
  });

  it('reports a plain message, fingerprinted without ids so one failure mode is one issue', () => {
    logger.error(
      'Reconciliation failed for booking 3f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
      undefined,
      'DuffelReconciliationService',
    );

    expect(captureMessage).toHaveBeenCalled();
    expect(scope.setFingerprint).toHaveBeenCalledWith([
      'DuffelReconciliationService',
      'Reconciliation failed for booking <uuid>',
    ]);
  });

  it('redacts PII before it reaches Sentry', () => {
    logger.error('No account for user@example.com', undefined, 'Mail');

    expect(captureMessage).toHaveBeenCalledWith(
      'No account for [REDACTED_EMAIL]',
    );
  });

  it('does not report below error level', () => {
    logger.warn('slow Duffel response');

    expect(captureMessage).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });
});
