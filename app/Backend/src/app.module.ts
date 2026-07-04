import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { RedisModule } from './redis/redis.module';
import { FlightsModule } from './flights/flights.module';

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
        GOOGLE_CLIENT_ID: Joi.string().optional(),
        GOOGLE_CLIENT_SECRET: Joi.string().optional(),
        GOOGLE_REDIRECT_URI: Joi.string().uri().optional(),
        DUFFEL_API_KEY: Joi.string().optional(),
      }),
    }),
    DatabaseModule,
    RedisModule,
    HealthModule,
    AuthModule,
    FlightsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
