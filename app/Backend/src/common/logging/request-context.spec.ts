import { getRequestId, runWithRequestId } from './request-context';

describe('request-context', () => {
  it('returns undefined outside any request context', () => {
    expect(getRequestId()).toBeUndefined();
  });

  it('exposes the requestId to synchronous code inside runWithRequestId', () => {
    runWithRequestId('req-123', () => {
      expect(getRequestId()).toBe('req-123');
    });
  });

  it('exposes the requestId across async continuations within the same run', async () => {
    await runWithRequestId('req-456', async () => {
      await Promise.resolve();
      expect(getRequestId()).toBe('req-456');
    });
  });

  it('isolates concurrent contexts from each other', async () => {
    const results: string[] = [];
    await Promise.all([
      runWithRequestId('req-a', async () => {
        await new Promise((r) => setTimeout(r, 10));
        results.push(getRequestId()!);
      }),
      runWithRequestId('req-b', async () => {
        await Promise.resolve();
        results.push(getRequestId()!);
      }),
    ]);
    expect(results.sort()).toEqual(['req-a', 'req-b']);
  });
});
