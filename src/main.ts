import * as fs from 'fs';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { OpenAPIObject } from '@nestjs/swagger';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { AuthService as BetterAuthService } from '@thallesp/nestjs-better-auth';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import * as express from 'express';
import { AppModule } from './app.module';
import {
  API_GLOBAL_PREFIX,
  APP_NAME,
  DEFAULT_PORT,
} from './commons/constants/app.constants';
import { LoggerService } from './commons/logger/logger.service';
import { correlationIdMiddleware } from './commons/middlewares/correlation-id.middleware';
import { SanitizeRequestPipe } from './commons/pipes/sanitize-request.pipe';
import type { BetterAuthSchema } from './modules/auth/better-auth.interface';

/**
 * Main application bootstrap function for Nest-Base.
 * Implements high-performance documentation with Scalar and efficient body parsing.
 */
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false, // Required for BetterAuth raw body handling
    bufferLogs: true,
  });

  const logger = new LoggerService('Application');
  app.useLogger(logger);
  app.set('query parser', 'extended');

  // 1. Configure CORS - Primary security layer
  app.enableCors({
    origin: true,
    credentials: true,
  });

  /*
   * 2. Smart Body Parser Implementation
   * Branched logic to provide raw bodies for Auth and JSON for application routes.
   * This is critical to prevent API hangs when bodyParser is false.
   */
  app.use(
    (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      const authPath = `/${API_GLOBAL_PREFIX}/auth`;
      if (req.path.startsWith(authPath)) {
        next();
      } else {
        express.json({ limit: '50mb' })(req, res, (err) => {
          if (err) return next(err);
          express.urlencoded({ extended: true, limit: '50mb' })(req, res, next);
        });
      }
    },
  );

  // Middlewares & Global configs
  app.use(correlationIdMiddleware);
  app.use(cookieParser());
  app.use(compression());

  const reflector = app.get<Reflector>(Reflector);
  app.useGlobalPipes(
    new SanitizeRequestPipe(),
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new ClassSerializerInterceptor(reflector));

  app.setGlobalPrefix(API_GLOBAL_PREFIX, {
    exclude: [`/${API_GLOBAL_PREFIX}/auth/*path`, '/'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('APP_PORT') ?? DEFAULT_PORT;

  // --- DOCUMENTATION 1: Main APIs (Scalar) ---
  const mainConfig = new DocumentBuilder()
    .setTitle(APP_NAME)
    .setDescription('Primary API documentation for Nest Base.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const mainDocument = SwaggerModule.createDocument(app, mainConfig);

  // Add logo metadata for Scalar
  const info = mainDocument.info as unknown as Record<string, unknown>;
  info['x-logo'] = {
    url: 'https://scalar.com/logo.svg',
    altText: 'Nest-Base Logo',
  };

  //  Main Application APIs
  app.use(
    `/${API_GLOBAL_PREFIX}/docs`,
    apiReference({
      spec: { content: mainDocument },
      theme: 'deepSpace',
      layout: 'modern',
      authentication: {
        preferredSecurityScheme: 'bearer',
      },
    }),
  );

  //  BetterAuth APIs (Isolated for performance)
  try {
    const authService = app.get(BetterAuthService);
    const authInstance = authService.instance as unknown as {
      api: { generateOpenAPISchema: () => Promise<BetterAuthSchema> };
    };

    if (authInstance?.api?.generateOpenAPISchema) {
      const authSchema = await authInstance.api.generateOpenAPISchema();
      const authPaths: Record<string, unknown> = {};

      Object.entries(authSchema.paths).forEach(([key, value]) => {
        authPaths[`/${API_GLOBAL_PREFIX}/auth${key}`] = value;
      });

      const authDocument = {
        openapi: '3.0.0',
        info: {
          title: `${APP_NAME} Auth API`,
          version: '1.0',
          description: 'Authentication API documentation for Nest-Base',
          'x-logo': {
            url: 'https://scalar.com/logo.svg',
            altText: 'Auth Logo',
          },
        },
        paths: authPaths,
        components: authSchema.components,
      } as unknown as OpenAPIObject;

      app.use(
        `/${API_GLOBAL_PREFIX}/auth/docs`,
        apiReference({
          spec: { content: authDocument },
          theme: 'deepSpace',
          layout: 'modern',
        }),
      );

      // Expose Auth OpenAPI JSON
      app
        .getHttpAdapter()
        .get(
          `/${API_GLOBAL_PREFIX}/auth/openapi.json`,
          (req: express.Request, res: express.Response) => {
            res.json(authDocument);
          },
        );

      fs.writeFileSync('./open-api-auth.json', JSON.stringify(authDocument));
    }
  } catch (error) {
    logger.warn(
      `Failed to generate Auth Scalar documentation for Nest-Base: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }

  // Expose Main OpenAPI JSON
  app
    .getHttpAdapter()
    .get(
      `/${API_GLOBAL_PREFIX}/openapi.json`,
      (req: express.Request, res: express.Response) => {
        res.json(mainDocument);
      },
    );

  // Persist schema for external consumers
  fs.writeFileSync('./open-api.json', JSON.stringify(mainDocument));

  await app.listen(port);
  logger.log(`Nest-Base is running on url http://localhost:${port}`);
  app.enableShutdownHooks();
}

void bootstrap();
