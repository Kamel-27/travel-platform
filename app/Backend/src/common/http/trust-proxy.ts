import type { INestApplication } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

/**
 * How many reverse-proxy hops sit between the public internet and this
 * process. Express only honours `X-Forwarded-For` (and therefore gives
 * `req.ip`, the throttler tracker and the magic-link / search IP limits a
 * real client address) when `trust proxy` is set to that number.
 *
 * In production the API is always behind Caddy (one hop), so the default is
 * 1 there. Anywhere else the default is 0, because a process reachable
 * directly must not believe a header any client can forge.
 */
export function resolveTrustProxyHops(config: ConfigService): number {
  const explicit = config.get<number | string>('TRUST_PROXY_HOPS');
  if (explicit !== undefined && explicit !== null && explicit !== '') {
    const n = Number(explicit);
    if (Number.isInteger(n) && n >= 0) {
      return n;
    }
  }
  return config.get<string>('NODE_ENV') === 'production' ? 1 : 0;
}

interface ExpressLike {
  set(setting: string, value: unknown): unknown;
}

export function configureTrustProxy(
  app: INestApplication,
  config: ConfigService,
): number {
  const hops = resolveTrustProxyHops(config);
  const instance = app.getHttpAdapter().getInstance() as ExpressLike;
  // Express: a number trusts the N right-most entries of X-Forwarded-For.
  // 0 disables header-based client address resolution entirely.
  instance.set('trust proxy', hops);
  return hops;
}
