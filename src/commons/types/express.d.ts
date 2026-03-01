/**
 * Extend Express Request interface to include custom properties.
 * Uses 'express-serve-static-core' because that's where Express
 * actually defines the Request interface.
 * This provides full type-safety without needing `any` casts.
 */
declare namespace Express {
  interface Request {
    /** Unique correlation ID for tracing requests across logs */
    correlationId: string;
  }
}
