import type { ArgumentsHost } from '@nestjs/common';
import { Catch, Injectable } from '@nestjs/common';
import type { ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { LoggerService } from '../logger/logger.service';
import { getCorrelationId } from '../middlewares/correlation-id.middleware';
import { APIError } from 'better-auth';

interface BetterAuthError extends Error {
  status?: number;
  statusCode?: number;
  body?: {
    message?: string;
    code?: string;
  };
}

@Catch(APIError)
@Injectable()
export class BetterAuthErrorExceptionFilter implements ExceptionFilter {
  private readonly logger = new LoggerService(
    BetterAuthErrorExceptionFilter.name,
  );

  catch(exception: APIError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const error = exception as unknown as BetterAuthError;

    const status = error.statusCode || error.status || 500;
    const message =
      error.body?.message || error.message || 'Authentication error';
    const correlationId = getCorrelationId(request);

    // Log async (Fire-and-Forget) - Not block request
    this.logExceptionAsync(error, correlationId);

    // Standardized response format — consistent across all filters
    response.status(status).json({
      statusCode: status,
      message,
      code: error.body?.code || 'AUTH_ERROR',
    });
  }

  /**
   * Log exception async - Fire and Forget pattern
   * Not await, not block request
   */
  private logExceptionAsync(
    error: BetterAuthError,
    correlationId: string,
  ): void {
    // Use setImmediate to defer logging, not block current request
    setImmediate(() => {
      try {
        this.logger.error(
          error.message,
          undefined,
          correlationId,
          error.stack || '',
        );
      } catch {
        this.logger.errorConsoleOnly(error.message);
      }
    });
  }
}
