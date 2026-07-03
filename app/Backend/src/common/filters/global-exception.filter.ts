/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ErrorCode } from '../dto/error-response.dto';
import type { ErrorEnvelope } from '../dto/error-response.dto';

/**
 * Global exception filter that normalizes every error response into the
 * standard envelope defined in docs/api_contract.md §0:
 *
 *   { "error": { "code": "…", "message": "…", "details": {} } }
 *
 * class-validator errors are unwrapped into per-field detail objects.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    const { status, body } = this.buildResponse(exception);
    res.status(status).json(body);
  }

  private buildResponse(exception: unknown): {
    status: number;
    body: ErrorEnvelope;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // class-validator pipes return { message: string[] | string, error, statusCode }
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const raw = exceptionResponse as Record<string, unknown>;
        const messages = raw['message'];

        // Validation errors from class-validator pipe
        if (status === HttpStatus.BAD_REQUEST && Array.isArray(messages)) {
          return {
            status,
            body: {
              error: {
                code: ErrorCode.VALIDATION_ERROR,
                message: 'Validation failed',
                details: { constraints: messages },
              },
            },
          };
        }

        // Custom error thrown with our code convention: { code, message, details }
        if (typeof raw['code'] === 'string') {
          return {
            status,
            body: {
              error: {
                code: raw['code'],
                message:
                  typeof raw['message'] === 'string'
                    ? raw['message']
                    : exception.message,
                details: (raw['details'] as Record<string, unknown>) ?? {},
              },
            },
          };
        }
      }

      // Generic HttpException (thrown by NestJS guards, etc.)
      return {
        status,
        body: {
          error: {
            code: this.httpStatusToCode(status),
            message:
              typeof exceptionResponse === 'string'
                ? exceptionResponse
                : exception.message,
            details: {},
          },
        },
      };
    }

    // Unexpected / unhandled exception
    this.logger.error(
      'Unhandled exception',
      exception instanceof Error ? exception.stack : String(exception),
    );

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Internal server error',
          details: {},
        },
      },
    };
  }

  private httpStatusToCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.VALIDATION_ERROR;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.UNAUTHENTICATED;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCode.RATE_LIMITED;
      case HttpStatus.SERVICE_UNAVAILABLE:
        return ErrorCode.SUPPLIER_UNAVAILABLE;
      default:
        return ErrorCode.INTERNAL_ERROR;
    }
  }
}
