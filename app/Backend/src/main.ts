import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Base path per docs/api_contract.md §0; /health stays unprefixed for probes
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
