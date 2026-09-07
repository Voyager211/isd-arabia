import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { AppConfigService } from './config/config.service';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { buildOpenApiDocument, SWAGGER_PATH } from './config/openapi';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));
  const config = app.get(AppConfigService);

  app.setGlobalPrefix(config.apiPrefix);

  // Render and Vercel both sit behind a proxy; without this `req.ip` is the
  // proxy address, which breaks per-IP rate limiting and the provenance
  // recorded on quotations.
  app.set('trust proxy', 1);

  app.use(cookieParser());

  app.use(
    helmet({
      // The API serves JSON, not documents. A restrictive CSP here costs
      // nothing and the storefront sets its own.
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
      hsts: config.isProduction ? { maxAge: 31_536_000, includeSubDomains: true } : false,
    }),
  );

  // Explicit allowlist — never `origin: '*'` alongside credentials, which the
  // httpOnly auth cookies require (PROJECT_PLAN.md §12.3).
  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-revalidate-secret'],
    maxAge: 86_400,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      // `whitelist` strips unknown properties and `forbidNonWhitelisted`
      // rejects them outright — together they stop a client smuggling an
      // unexpected field into a document.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      validationError: { target: false, value: false },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter(config.isProduction));

  /**
   * Swagger enumerates every route, parameter and validation rule — a map of
   * the attack surface. Off in production unless SWAGGER_ENABLED says
   * otherwise; docs/openapi.json is the committed alternative (§3.3).
   */
  if (config.swaggerEnabled) {
    SwaggerModule.setup(`${config.apiPrefix}/${SWAGGER_PATH}`, app, buildOpenApiDocument(app), {
      swaggerOptions: { persistAuthorization: true },
      customSiteTitle: 'ISD Arabia API',
    });
  }

  app.enableShutdownHooks();

  await app.listen(config.port, '0.0.0.0');
  app
    .get(Logger)
    .log(`API listening on port ${config.port} at ${config.apiPrefix} [${config.nodeEnv}]`);
}

void bootstrap();
