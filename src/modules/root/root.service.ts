import { Injectable } from '@nestjs/common';
import {
  HealthCheckService,
  TypeOrmHealthIndicator,
  RedisHealthIndicator,
  HealthCheck,
  HealthCheckResult,
} from '@nestjs/terminus';
import { RedisService } from '@/services/redis/redis.service';

@Injectable()
export class RootService {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly redisHealth: RedisHealthIndicator,
    private readonly redisService: RedisService,
  ) {}

  @HealthCheck()
  public async getHealth(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () =>
        this.redisHealth.check('redis', {
          type: 'redis',
          client: this.redisService.client,
        }),
    ]);
  }
}
