import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RootService } from './root.service';
import { RateLimit } from '@/commons/decorators/rate-limit.decorator';
import { HealthCheckResult } from '@nestjs/terminus';

@ApiTags('Root')
@Controller()
export class RootController {
  constructor(private readonly rootService: RootService) {}

  @AllowAnonymous()
  @Get('health')
  @RateLimit({ limit: 10, ttl: 10000 })
  getHealth(): Promise<HealthCheckResult> {
    return this.rootService.getHealth();
  }
}
