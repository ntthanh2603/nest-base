import { ErrorCode } from './error-codes';
import { CustomException } from './custom.exception';

/**
 * Bad Request (400)
 * Used for validation errors, invalid input
 */
export class BadRequest extends CustomException {
  constructor(message: string, code: ErrorCode = ErrorCode.INVALID_INPUT) {
    super({
      statusCode: 400,
      code,
      message,
    });
    Object.setPrototypeOf(this, BadRequest.prototype);
  }
}

/**
 * Unauthorized (401)
 * Used for authentication failures
 */
export class Unauthorized extends CustomException {
  constructor(
    message: string = 'Unauthorized',
    code: ErrorCode = ErrorCode.UNAUTHORIZED,
  ) {
    super({
      statusCode: 401,
      code,
      message,
    });
    Object.setPrototypeOf(this, Unauthorized.prototype);
  }
}

/**
 * Forbidden (403)
 * Used for authorization failures
 */
export class Forbidden extends CustomException {
  constructor(
    message: string = 'Forbidden',
    code: ErrorCode = ErrorCode.FORBIDDEN,
  ) {
    super({
      statusCode: 403,
      code,
      message,
    });
    Object.setPrototypeOf(this, Forbidden.prototype);
  }
}

/**
 * Not Found (404)
 * Used when resource doesn't exist
 */
export class NotFound extends CustomException {
  constructor(message: string, code: ErrorCode = ErrorCode.RESOURCE_NOT_FOUND) {
    super({
      statusCode: 404,
      code,
      message,
    });
    Object.setPrototypeOf(this, NotFound.prototype);
  }
}

/**
 * Conflict (409)
 * Used when resource already exists
 */
export class Conflict extends CustomException {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.RESOURCE_ALREADY_EXISTS,
  ) {
    super({
      statusCode: 409,
      code,
      message,
    });
    Object.setPrototypeOf(this, Conflict.prototype);
  }
}

/**
 * Internal Server Error (500)
 * Used for unexpected server errors
 */
export class InternalError extends CustomException {
  constructor(
    message: string = 'Internal server error',
    code: ErrorCode = ErrorCode.INTERNAL_SERVER_ERROR,
  ) {
    super({
      statusCode: 500,
      code,
      message,
    });
    Object.setPrototypeOf(this, InternalError.prototype);
  }
}

/**
 * Too Many Requests (429)
 * Used for rate limiting
 */
export class TooManyRequestsException extends CustomException {
  constructor(message: string = 'Too many requests') {
    super({
      statusCode: 429,
      code: ErrorCode.TOO_MANY_REQUESTS,
      message,
    });
    Object.setPrototypeOf(this, TooManyRequestsException.prototype);
  }
}
