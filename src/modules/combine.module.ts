import { Module } from '@nestjs/common';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { getAuth } from './auth/auth';
import { UsersModule } from './users/users.module';
import { RootModule } from './root/root.module';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { MailService } from '@/services/mail/mail.service';
import { RedisService } from '@/services/redis/redis.service';

@Module({
  imports: [
    AuthModule.forRootAsync({
      inject: [ConfigService, 'PG_POOL', MailService, RedisService],
      useFactory: (
        configService: ConfigService,
        pool: Pool,
        mailService: MailService,
        redisService: RedisService,
      ) => ({
        auth: getAuth(pool, configService, mailService, redisService),
      }),
    }),
    UsersModule,
    RootModule,
  ],
})
export class CombineModule {}
