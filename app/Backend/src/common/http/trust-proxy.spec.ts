import { ConfigService } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';
import { configureTrustProxy, resolveTrustProxyHops } from './trust-proxy';

function configWith(values: Record<string, unknown>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('resolveTrustProxyHops', () => {
  it('defaults to one hop in production, because Caddy is always in front', () => {
    expect(resolveTrustProxyHops(configWith({ NODE_ENV: 'production' }))).toBe(
      1,
    );
  });

  it('defaults to zero hops outside production so a forged header is ignored', () => {
    expect(resolveTrustProxyHops(configWith({ NODE_ENV: 'development' }))).toBe(
      0,
    );
    expect(resolveTrustProxyHops(configWith({ NODE_ENV: 'test' }))).toBe(0);
  });

  it('honours an explicit TRUST_PROXY_HOPS, including zero in production', () => {
    expect(
      resolveTrustProxyHops(
        configWith({ NODE_ENV: 'production', TRUST_PROXY_HOPS: 2 }),
      ),
    ).toBe(2);
    expect(
      resolveTrustProxyHops(
        configWith({ NODE_ENV: 'production', TRUST_PROXY_HOPS: '0' }),
      ),
    ).toBe(0);
  });

  it('falls back to the environment default on an empty or invalid value', () => {
    expect(
      resolveTrustProxyHops(
        configWith({ NODE_ENV: 'production', TRUST_PROXY_HOPS: '' }),
      ),
    ).toBe(1);
    expect(
      resolveTrustProxyHops(
        configWith({ NODE_ENV: 'development', TRUST_PROXY_HOPS: 'many' }),
      ),
    ).toBe(0);
    expect(
      resolveTrustProxyHops(
        configWith({ NODE_ENV: 'development', TRUST_PROXY_HOPS: -1 }),
      ),
    ).toBe(0);
  });
});

describe('configureTrustProxy', () => {
  it('sets the Express trust proxy setting to the resolved hop count', () => {
    const set = jest.fn();
    const app = {
      getHttpAdapter: () => ({ getInstance: () => ({ set }) }),
    } as unknown as INestApplication;

    const hops = configureTrustProxy(
      app,
      configWith({ NODE_ENV: 'production' }),
    );

    expect(hops).toBe(1);
    expect(set).toHaveBeenCalledWith('trust proxy', 1);
  });
});
