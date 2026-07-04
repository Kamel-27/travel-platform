import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { runWithRequestId } from '../logging/request-context';

const HEADER = 'x-request-id';

/**
 * Correlates every log line for a request (nfr.md §7). Reuses an inbound
 * X-Request-Id if the caller supplied one, otherwise generates one; echoes
 * it back on the response so client-side error reports can reference it.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = (req.headers[HEADER] as string) || randomUUID();
    res.setHeader('X-Request-Id', requestId);
    runWithRequestId(requestId, next);
  }
}
