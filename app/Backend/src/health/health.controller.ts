import { Controller, Get, Inject } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckError,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      async () => {
        try {
          await this.redis.ping();
          return { redis: { status: 'up' as const } };
        } catch (err) {
          throw new HealthCheckError('Redis ping failed', {
            redis: {
              status: 'down' as const,
              message: err instanceof Error ? err.message : String(err),
            },
          });
        }
      },
    ]);
  }
}
