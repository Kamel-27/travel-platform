import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { RedisModule } from './redis/redis.module';
import { FlightsModule } from './flights/flights.module';
import { BookingsModule } from './bookings/bookings.module';
import { PaymentsModule } from './payments/payments.module';
import { AdminModule } from './admin/admin.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'test', 'production')
          .default('development'),
        PORT: Joi.number().default(3001),
        DATABASE_URL: Joi.string().uri().required(),
        REDIS_URL: Joi.string().uri().required(),
        JWT_SECRET: Joi.string().required(),
        ACCESS_TOKEN_TTL_SECONDS: Joi.number().default(900),
        REFRESH_TOKEN_TTL_DAYS: Joi.number().default(30),
        WEB_APP_URL: Joi.string().default('http://localhost:3000'),
        // Optional integrations — empty string = unconfigured (endpoints
        // return a clean 503 via assertConfigured(); the app must still boot)
        GOOGLE_CLIENT_ID: Joi.string().allow('').optional(),
        GOOGLE_CLIENT_SECRET: Joi.string().allow('').optional(),
        GOOGLE_REDIRECT_URI: Joi.string().uri().allow('').optional(),
        DUFFEL_API_KEY: Joi.string().allow('').optional(),
        PAYMOB_API_BASE: Joi.string().uri().allow('').optional(),
        PAYMOB_API_KEY: Joi.string().allow('').optional(),
        PAYMOB_INTEGRATION_ID: Joi.string().allow('').optional(),
        PAYMOB_IFRAME_ID: Joi.string().allow('').optional(),
        PAYMOB_HMAC_SECRET: Joi.string().allow('').optional(),
      }),
    }),
    ScheduleModule.forRoot(),
    // Inbound rate limiting per nfr.md §3 — blanket per-IP ceiling; specific
    // endpoints (e.g. flights/search) tighten this with @Throttle().
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 100,
      },
    ]),
    BullModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.getOrThrow<string>('REDIS_URL'),
        },
      }),
      inject: [ConfigService],
    }),
    DatabaseModule,
    RedisModule,
    HealthModule,
    AuthModule,
    FlightsModule,
    BookingsModule,
    PaymentsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
