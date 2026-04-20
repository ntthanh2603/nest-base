import { applyDecorators, HttpStatus, SetMetadata } from '@nestjs/common';
import {
  ApiConsumes,
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import type { ExampleObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

import { ErrorResponseDto } from '../dtos/error-response.dto';
import type {
  IDocErrorOptions,
  IDocOptions,
  IDocResponseOptions,
} from './doc.interface';
import { AppResponseSerialization } from './response.serialization';
import { FILE_UPLOAD_METADATA_KEY } from '../decorators/file-upload.decorator';

export const RESPONSE_DOCS_METADATA = 'RESPONSE_DOCS_METADATA';

/**
 * Apply common decorators for API documentation
 * @param options Documentation options
 * @returns Array of method decorators
 */
function applyCommonDecorators<T>(options?: IDocOptions<T>): MethodDecorator[] {
  const decorators: MethodDecorator[] = [];
  decorators.push(ApiConsumes(getContentType(options?.request?.bodyType)));
  decorators.push(ApiProduces('application/json'));
  decorators.push(DocDefault(options?.response || {}));

  return decorators;
}

/**
 * Apply parameter decorators for API documentation
 * @param options Documentation options
 * @returns Array of method decorators
 */

function applyParamDecorators<T>(options?: IDocOptions<T>): MethodDecorator[] {
  const decorators: MethodDecorator[] = [];

  if (options?.request?.params?.length) {
    decorators.push(...options.request.params.map(ApiParam));
  }

  if (options?.request?.queries?.length) {
    decorators.push(...options.request.queries.map(ApiQuery));
  }

  return decorators;
}

/**
 * Apply operation decorators for API documentation
 * @param options Documentation options
 * @returns Array of method decorators
 */
function applyOperationDecorators<T>(
  options?: IDocOptions<T>,
): MethodDecorator[] {
  const decorators: MethodDecorator[] = [];

  if (options?.description || options?.summary || options?.operationId) {
    decorators.push(
      ApiOperation({
        description: options.description,
        summary: options.summary,
        operationId: options.operationId,
      }),
    );
  }

  return decorators;
}

/**
 * Decorator for documenting API endpoints with Swagger
 * @param options Documentation options
 * @returns Method decorator
 */
export function Doc<T>(options?: IDocOptions<T>): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<unknown>,
  ) => {
    // Check metadata from the function itself (SetMetadata puts it here)
    const isFileUpload = Reflect.getMetadata(
      FILE_UPLOAD_METADATA_KEY,
      descriptor.value as object,
    ) as boolean | undefined;

    const effectiveOptions = { ...options };
    if (isFileUpload && !effectiveOptions.request?.bodyType) {
      if (!effectiveOptions.request) {
        effectiveOptions.request = {};
      }
      effectiveOptions.request.bodyType = 'FORM_DATA';
    }

    const decorators: MethodDecorator[] = [];

    // Always include error models in schemas to ensure enums are generated for frontend
    decorators.push(ApiExtraModels(ErrorResponseDto));

    // Apply common decorators
    decorators.push(...applyCommonDecorators(effectiveOptions));

    // Apply parameter decorators
    decorators.push(...applyParamDecorators(effectiveOptions));

    // Apply error decorators
    decorators.push(...applyErrorDecorators(effectiveOptions?.errors));

    // Apply operation decorators
    decorators.push(...applyOperationDecorators(effectiveOptions));

    // Add metadata
    decorators.push(SetMetadata(RESPONSE_DOCS_METADATA, true));

    return applyDecorators(...decorators)(target, propertyKey, descriptor);
  };
}

/**
 * Get content type based on body type
 * @param bodyType Body type
 * @returns Content type string
 */
function getContentType(bodyType?: 'FORM_DATA' | 'JSON'): string {
  return bodyType === 'FORM_DATA' ? 'multipart/form-data' : 'application/json';
}

/**
 * Create default documentation response
 * @param options Response options
 * @returns Method decorator
 */
function DocDefault<T>({
  dataSchema,
  description,
  extraModels = [],
  isArray = false,
  httpStatus = HttpStatus.OK,
  serialization,
}: Omit<IDocResponseOptions<T>, 'messageExample'>): MethodDecorator {
  const decorators: MethodDecorator[] = [];

  const schema: Record<string, unknown> = {
    allOf: [{ $ref: getSchemaPath(AppResponseSerialization<T>) }],
  };

  if (dataSchema) {
    Object.assign(schema, dataSchema);
  } else if (serialization) {
    decorators.push(ApiExtraModels(serialization));
    if (isArray) {
      Object.assign(schema, {
        properties: {
          data: {
            type: 'array',
            items: { $ref: getSchemaPath(serialization) },
          },
        },
      });
    } else {
      Object.assign(schema, {
        $ref: getSchemaPath(serialization),
      });
    }
  }

  // Always include AppResponseSerialization and extra models
  decorators.push(ApiExtraModels(AppResponseSerialization<T>));
  extraModels.forEach((model) => {
    if (model) {
      decorators.push(ApiExtraModels(model));
    }
  });

  decorators.push(
    ApiResponse({
      description,
      status: httpStatus,
      schema,
    }),
  );

  return applyDecorators(...decorators);
}

/**
 * Apply error decorators for API documentation
 * Groups errors by status code and creates examples for Swagger
 * @param errors Error options
 * @returns Array of method decorators
 */
function applyErrorDecorators(errors?: IDocErrorOptions[]): MethodDecorator[] {
  if (!errors || errors.length === 0) return [];

  // Group errors by status code
  const groupedByStatus = errors.reduce(
    (acc, curr) => {
      const status = curr.status as number;
      if (!acc[status]) {
        acc[status] = [];
      }
      acc[status].push(curr);
      return acc;
    },
    {} as Record<number, IDocErrorOptions[]>,
  );

  return Object.entries(groupedByStatus).map(([status, errorGroup]) => {
    const examples: Record<string, ExampleObject> = {};

    errorGroup.forEach((error, index) => {
      const key = error.errorCode ? String(error.errorCode) : `error_${index}`;
      examples[key] = {
        summary: error.message || `Error code: ${error.errorCode}`,
        value: {
          statusCode: Number.parseInt(status, 10),
          message: error.message || 'Error occurred',
          code: error.errorCode,
        },
      };
    });

    return ApiResponse({
      status: Number.parseInt(status, 10),
      description: errorGroup.map((e) => e.message).join(' / '),
      content: {
        'application/json': {
          schema: { $ref: getSchemaPath(ErrorResponseDto) },
          examples,
        },
      },
    });
  });
}
