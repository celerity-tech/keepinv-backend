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

  // Pin HTTPS hard. Without `preload`, a fresh device is only HSTS-pinned after its
  // first direct https response from this host; until then a plaintext request (e.g. a
  // page loaded over http) is 301'd to https by the edge — and browsers downgrade a
  // redirected POST to GET, so an upload silently becomes `GET /products/:id/image` 404.
  // With `preload` (once api.keepinv.com is on the HSTS preload list) browsers never send
  // plaintext at all, so the POST survives. 2y max-age + includeSubDomains are preload
  // prerequisites. All other helmet defaults are preserved.
  app.use(
    helmet({
      hsts: {
        maxAge: 63072000,
        includeSubDomains: true,
        preload: true,
      },
    }),
  );

  app.enableCors({
    origin: env.CORS_ALLOWED_ORIGINS,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  await app.listen(env.PORT, '0.0.0.0');
}
bootstrap();
