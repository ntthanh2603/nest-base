import { ApiProperty } from '@nestjs/swagger';
import { ErrorCode } from '../exceptions/error-codes';

/**
 * Standard error response structure for the API
 */
export class ErrorResponseDto {
  /**
   * HTTP status code
   * @example 400
   */
  @ApiProperty({ example: 400 })
  statusCode: number;

  /**
   * Human-readable error message
   * @example "Invalid input data"
   */
  @ApiProperty({ example: 'Error occurred' })
  message: string;

  /**
   * Machine-readable error code for frontend handling
   * @example "INVALID_INPUT"
   */
  @ApiProperty({ enum: ErrorCode, enumName: 'ErrorCode', example: ErrorCode.INVALID_INPUT })
  code: ErrorCode;

  /**
   * Additional error details (optional)
   */
  @ApiProperty({ required: false })
  data?: unknown;
}
