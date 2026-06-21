import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';

import helmet from 'helmet';

import { AppModule } from './app.module';
import { env } from './core/config/env.config';

async function bootstrap() {
  // bodyParser:false hands the raw request body to Better Auth; @thallesp/nestjs-better-auth
  // re-adds the default body parsers for all non-auth routes.
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  app.enableShutdownHooks();

  app.use(helmet());

  app.enableCors({
    origin: env.CORS_ALLOWED_ORIGINS,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  await app.listen(env.PORT, '0.0.0.0');
}
bootstrap();
