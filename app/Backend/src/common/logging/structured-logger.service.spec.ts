/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { StructuredLoggerService } from './structured-logger.service';
import { runWithRequestId } from './request-context';

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
