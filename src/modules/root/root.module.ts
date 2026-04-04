import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { RootService } from './root.service';
import { RootController } from './root.controller';
import { RedisService } from '@/services/redis/redis.service';

@Module({
  imports: [TerminusModule],
  controllers: [RootController],
  providers: [RootService, RedisService],
})
export class RootModule {}
