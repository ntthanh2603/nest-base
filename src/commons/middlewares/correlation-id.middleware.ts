import type { Request, Response, NextFunction } from 'express';
import { generateId } from '../../utils/nanoid-generators';

/**
 * Middleware that generates and attaches a unique correlationId to each request.
 * If upstream already provides X-Correlation-ID header, it will be reused (microservice friendly).
 * This ID can be used to trace logs across the entire request lifecycle.
 */
export function correlationIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Reuse upstream correlation ID if present, otherwise generate a new one
  const correlationId =
    (req.headers['x-correlation-id'] as string) || generateId();

  // Attach to request object (typed via express.d.ts — no `any` cast needed)
  req.correlationId = correlationId;

  // Add to response headers for client tracing
  res.setHeader('X-Correlation-ID', correlationId);

  next();
}

/**
 * Helper to get correlation ID from request (type-safe)
 */
export function getCorrelationId(req: Request): string {
  return req.correlationId || 'unknown';
}
