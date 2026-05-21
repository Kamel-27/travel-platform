import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Global API prefix
  const apiPrefix = config.get<string>('API_PREFIX') || 'api/v1';
  app.setGlobalPrefix(apiPrefix);

  // CORS
  const frontendUrl = config.get<string>('FRONTEND_URL') || 'http://localhost:3001';
  app.enableCors({
    origin: [frontendUrl],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,          // Strip unknown properties
      forbidNonWhitelisted: true, // Throw on unknown properties
      transform: true,          // Auto-transform payloads to DTO types
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger Documentation setup
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Travel Platform B2B API')
    .setDescription('The Travel Platform API documentation for B2B booking and agent wallets.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = config.get<number>('PORT') || 3000;
  await app.listen(port);

  logger.log(`🚀 Travel Platform API running on http://localhost:${port}/${apiPrefix}`);
  logger.log(`📚 Interactive Swagger Docs available at http://localhost:${port}/docs`);
  logger.log(`📋 Environment: ${config.get<string>('NODE_ENV')}`);
}

bootstrap();
