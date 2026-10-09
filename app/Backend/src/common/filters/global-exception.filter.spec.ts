/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  ArgumentsHost,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';
import { ErrorCode } from '../dto/error-response.dto';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let res: { status: jest.Mock; json: jest.Mock };
  let host: ArgumentsHost;
  let errorLog: jest.SpyInstance;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    host = {
      switchToHttp: () => ({ getResponse: () => res }),
    } as any;
    // Error-level logs are what the app logger forwards to Sentry.
    errorLog = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs a deliberate 5xx at error level — a supplier outage is an incident', () => {
    filter.catch(
      new ServiceUnavailableException({
        code: ErrorCode.SUPPLIER_UNAVAILABLE,
        message: 'Flight search is temporarily unavailable.',
      }),
      host,
    );

    expect(res.status).toHaveBeenCalledWith(503);
    expect(errorLog).toHaveBeenCalledWith(
      'HTTP 503 SUPPLIER_UNAVAILABLE: Flight search is temporarily unavailable.',
      expect.any(String),
    );
  });

  it('keeps 4xx business outcomes out of the error log', () => {
    filter.catch(new NotFoundException('Booking not found.'), host);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(errorLog).not.toHaveBeenCalled();
  });

  it('logs an unhandled exception with its stack and returns a generic 500', () => {
    const err = new TypeError('boom');

    filter.catch(err, host);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Internal server error',
        details: {},
      },
    });
    expect(errorLog).toHaveBeenCalledWith('Unhandled exception', err.stack);
  });
});
