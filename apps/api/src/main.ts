import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.enableCors({
    origin: (process.env.CORS_ORIGINS || 'http://localhost:8081,http://localhost:19006,http://127.0.0.1:8081').split(','),
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT || 3001), '0.0.0.0');
}

bootstrap().catch((error: unknown) => {
  // Never print connection URLs, which contain credentials.
  console.error('A API não iniciou. Confira MySQL e a configuração local.', error instanceof Error ? error.name : 'Erro');
  process.exitCode = 1;
});
