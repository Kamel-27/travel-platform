/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { RequestIdMiddleware } from './request-id.middleware';
import { getRequestId } from '../logging/request-context';

describe('RequestIdMiddleware', () => {
  let middleware: RequestIdMiddleware;

  beforeEach(() => {
    middleware = new RequestIdMiddleware();
  });

  it('generates a request id, sets the response header, and exposes it via ALS during next()', () => {
    const req: any = { headers: {} };
    const res: any = { setHeader: jest.fn() };
    let idSeenInNext: string | undefined;
    const next = jest.fn(() => {
      idSeenInNext = getRequestId();
    });

    middleware.use(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith(
      'X-Request-Id',
      expect.any(String),
    );
    const [, generatedId] = res.setHeader.mock.calls[0];
    expect(idSeenInNext).toBe(generatedId);
  });

  it('reuses an inbound X-Request-Id header instead of generating a new one', () => {
    const req: any = { headers: { 'x-request-id': 'client-provided-id' } };
    const res: any = { setHeader: jest.fn() };
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'X-Request-Id',
      'client-provided-id',
    );
  });
});
