import { Injectable } from '@nestjs/common';
import {
  HealthCheckService,
  TypeOrmHealthIndicator,
  HealthCheck,
  HealthCheckResult,
} from '@nestjs/terminus';
import { RedisService } from '@/services/redis/redis.service';

@Injectable()
export class RootService {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly redisService: RedisService,
  ) {}

  @HealthCheck()
  public async getHealth(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => {
        const isReady = this.redisService.client.status === 'ready';
        if (isReady) return { redis: { status: 'up' } };
        return { redis: { status: 'down', message: 'Redis is not ready' } };
      },
    ]);
  }
}
