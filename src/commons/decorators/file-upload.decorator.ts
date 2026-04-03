import { applyDecorators, UseInterceptors } from '@nestjs/common';
import {
  FileFieldsInterceptor,
  FileInterceptor,
  FilesInterceptor,
} from '@nestjs/platform-express';
import type { MulterField } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { ApiConsumes } from '@nestjs/swagger';

export interface ApiFileOptions {
  fieldName?: string;
  required?: boolean;
}

/**
 * Unified File Upload Decorator.
 * Handles single file (default), multiple files, and multiple named fields.
 * @param options Field name (string) OR array of field definitions (MulterField[])
 * @param maxCount Maximum number of files (default: 1 for singular, use ApiFiles for multiple)
 */
export function ApiFile(options: string | MulterField[], maxCount = 1) {
  const interceptor =
    typeof options === 'string'
      ? maxCount === 1
        ? FileInterceptor(options)
        : FilesInterceptor(options, maxCount)
      : FileFieldsInterceptor(options);

  return applyDecorators(
    UseInterceptors(interceptor),
    ApiConsumes('multipart/form-data'),
  );
}

/**
 * Multiple File Upload Decorator (Alias for ApiFile with maxCount > 1).
 */
export const ApiFiles = (options: string | MulterField[], maxCount = 10) =>
  ApiFile(options, maxCount);
