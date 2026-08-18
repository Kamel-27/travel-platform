// Must stay the first import: Sentry patches libraries as they're required,
// so anything imported above it loses instrumentation.
import './instrument';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { json } from 'express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { StructuredLoggerService } from './common/logging/structured-logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);

  // ── Structured JSON logs in production (nfr.md §7) — pretty console
  // output stays the default in dev, where a human is reading the terminal.
  if (config.get<string>('NODE_ENV') === 'production') {
    app.useLogger(new StructuredLoggerService());
  }

  // ── Security headers ────────────────────────────────────────────
  app.use(helmet());

  // ── CORS — strict: frontend origin only, credentials required ──
  app.enableCors({
    origin: config.get<string>('WEB_APP_URL', 'http://localhost:3000'),
    credentials: true,
  });

  // ── Cookie parser (for refresh-token httpOnly cookie) ───────────
  app.use(cookieParser());

  // ── Body size limit ─────────────────────────────────────────────
  app.use(json({ limit: '1mb' }));

  // ── Validation pipe — whitelist + transform per nfr.md §1 ──────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // ── Global exception filter — api_contract.md §0 envelope ──────
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Base path per docs/api_contract.md §0; /health stays unprefixed for probes
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
