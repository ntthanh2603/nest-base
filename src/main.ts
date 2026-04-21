import * as fs from 'fs';
import * as path from 'path';
import {
  ClassSerializerInterceptor,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { OpenAPIObject } from '@nestjs/swagger';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AuthService as BetterAuthService } from '@thallesp/nestjs-better-auth';
import compression from 'compression';
import cookieParser from 'cookie-parser';
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

async function bootstrap() {
  // suppressBetterAuthLogs();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    bufferLogs: true,
  });
  app.useLogger(app.get(LoggerService));
  app.set('query parser', 'extended');

  // Configure CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Register correlation ID middleware - Must be before all other middleware for proper tracking
  app.use(correlationIdMiddleware);

  // Configure global guards
  const reflector = app.get<Reflector>(Reflector);

  // Configure cookie parser
  app.use(cookieParser());
  // Compress responses
  app.use(compression());
  // Configure global validation
  app.useGlobalPipes(
    new SanitizeRequestPipe(),
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  // Configure global interceptors
  app.useGlobalInterceptors(new ClassSerializerInterceptor(reflector));
  // Configure global prefix
  app.setGlobalPrefix(API_GLOBAL_PREFIX, {
    exclude: [`/${API_GLOBAL_PREFIX}/auth/*path`, '/'],
  });

  // Show Swagger UI in development: http://localhost:3000/api/docs
  const config = new DocumentBuilder()
    .setTitle(APP_NAME)
    .setDescription('API documentation for the Nest base application.')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'bearer',
    )
    .setExternalDoc('Authentication Docs', 'auth/docs')
    .build();

  const documentFactory = async (): Promise<OpenAPIObject> => {
    const mainDocument = SwaggerModule.createDocument(app, config);
    try {
      const authService = app.get(BetterAuthService);
      const auth = authService.instance as {
        api: {
          generateOpenAPISchema: () => Promise<BetterAuthSchema>;
        };
      };

      if (!auth?.api?.generateOpenAPISchema) {
        return mainDocument;
      }

      const authSchema = await auth.api.generateOpenAPISchema();

      // Map paths of Auth to add prefix /auth
      const authPaths: Record<string, unknown> = {};
      Object.entries(authSchema.paths).forEach(([key, value]) => {
        authPaths[`${API_GLOBAL_PREFIX}/auth${key}`] = value;
      });

      const mergedComponents = {
        ...mainDocument.components,
        ...authSchema.components,
        schemas: {
          ...mainDocument.components?.schemas,
          ...authSchema.components?.schemas,
        },
      };

      return {
        ...mainDocument,
        paths: { ...mainDocument.paths, ...authPaths },
        components: mergedComponents,
      } as unknown as OpenAPIObject;
    } catch (e: unknown) {
      Logger.error(
        'Failed to merge Better Auth schema',
        e instanceof Error ? e.stack : undefined,
        'Bootstrap',
      );
      return mainDocument;
    }
  };

  const mergedDocument = await documentFactory();

  SwaggerModule.setup(`${API_GLOBAL_PREFIX}/docs`, app, () => mergedDocument, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Endpoint for OpenAPI JSON (dùng cho frontend)
  const server = app.getHttpAdapter().getInstance();
  server.get(`/${API_GLOBAL_PREFIX}/openapi.json`, (req, res) => {
    res.json(mergedDocument);
  });

  const pathOutputOpenApi = './open-api.json';

  // Create directory if it doesn't exist
  const directoryPath = path.dirname(pathOutputOpenApi);
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }

  fs.writeFileSync(pathOutputOpenApi, JSON.stringify(mergedDocument));

  const configService = app.get(ConfigService);
  const port = configService.get<number>('APP_PORT') ?? DEFAULT_PORT;
  await app.listen(port);
  const logger = new Logger('Application');
  logger.log(`Application is running on url http://localhost:${port}`);
}
void bootstrap();
