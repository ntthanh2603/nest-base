import { Module } from '@nestjs/common';
import { AuthGuard } from '@thallesp/nestjs-better-auth';

import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { CombineModule } from './modules/combine.module';
import { ServicesModule } from './services/services.module';
import databaseConfig from './database/database.config';
import { LoggerModule } from './commons/logger/logger.module';
import { CustomRateLimitGuard } from './commons/guards/rate-limit.guard';
import {
  AllExceptionsFilter,
  BetterAuthErrorExceptionFilter,
  HttpExceptionFilter,
  CustomExceptionFilter,
} from './commons/filters';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
      load: [databaseConfig],
    }),
    LoggerModule,
    DatabaseModule,
    ServicesModule,
    CombineModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CustomRateLimitGuard,
    },
    {
      provide: APP_FILTER,
      useClass: CustomExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: BetterAuthErrorExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: CustomExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: BetterAuthErrorExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
