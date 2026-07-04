import { AsyncLocalStorage } from 'async_hooks';

interface RequestContextStore {
  requestId: string;
}

const als = new AsyncLocalStorage<RequestContextStore>();

/** Runs `fn` with `requestId` available to any nested code via getRequestId(). */
export function runWithRequestId<T>(requestId: string, fn: () => T): T {
  return als.run({ requestId }, fn);
}

/** Returns the current request's id, or undefined outside a request context
 * (e.g. cron jobs — correlation to an inbound request doesn't apply there). */
export function getRequestId(): string | undefined {
  return als.getStore()?.requestId;
}
