import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { GlobalExceptionFilter } from './../src/common/filters/global-exception.filter';

/**
 * End-to-end smoke suite.
 *
 * Unlike the unit specs (which mock every dependency), this boots the real
 * AppModule against a real Postgres and Redis, so it is the only test that
 * proves the app actually *starts*: DI graph resolves, env validation passes,
 * TypeORM connects, Redis connects, BullMQ registers its queues, and the
 * global HTTP concerns from main.ts are wired the way callers expect.
 *
 * Requires the datastores to be up:
 *   docker compose up -d          (from the repo root)
 *   npm run migration:run
 *   npm run test:e2e
 *
 * CI provides both as service containers — see .github/workflows/ci.yml.
 */
describe('App (e2e)', () => {
  let app: INestApplication<App>;

  // Boot once for the whole suite: creating the app opens DB/Redis
  // connections, so per-test setup would be both slow and connection-hungry.
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Mirror the global setup in src/main.ts. If these drift apart, the e2e
    // suite stops testing what production actually serves.
    app.use(helmet());
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('reports the app, database and Redis as up', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);

      expect(res.body).toMatchObject({
        status: 'ok',
        info: {
          database: { status: 'up' },
          redis: { status: 'up' },
        },
      });
    });

    it('is served unprefixed, so container probes keep working', async () => {
      // /health is excluded from the api/v1 prefix for the Docker healthcheck
      // in docker-compose.prod.yml — assert the exclusion is still in place.
      await request(app.getHttpServer()).get('/api/v1/health').expect(404);
    });
  });

  describe('global HTTP concerns', () => {
    it('serves routes under the /api/v1 prefix', async () => {
      await request(app.getHttpServer())
        .get('/api/v1')
        .expect(200)
        .expect('Hello World!');
    });

    it('sets security headers from helmet', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1').expect(200);

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      // helmet strips the framework fingerprint
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('returns unknown routes in the standard error envelope', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/no-such-route')
        .expect(404);

      // Envelope per docs/api_contract.md §0
      expect(res.body).toEqual({
        error: {
          code: expect.any(String) as string,
          message: expect.any(String) as string,
          details: expect.any(Object) as Record<string, unknown>,
        },
      });
    });
  });

  describe('authentication', () => {
    it('rejects an unauthenticated request to a protected route', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/me')
        .expect(401);

      const body = res.body as { error?: unknown };
      expect(body.error).toBeDefined();
    });

    it('rejects a malformed bearer token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('Authorization', 'Bearer not-a-real-jwt')
        .expect(401);
    });
  });
});
