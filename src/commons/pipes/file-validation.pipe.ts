import {
  PipeTransform,
  Injectable,
  BadRequestException,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  FileValidator,
} from '@nestjs/common';
import { MAX_FILE_SIZE, ALLOWED_IMAGE_TYPES } from '../constants/app.constants';

export interface FileFieldValidationOptions {
  [fieldName: string]: {
    maxSize?: number;
    fileType?: string | RegExp;
    required?: boolean;
  };
}

/**
 * Factory to create highly configurable ParseFilePipe instances.
 */
export function createFileValidationPipe(options?: {
  maxSize?: number;
  fileType?: string | RegExp;
  required?: boolean;
}) {
  const validators: FileValidator[] = [];

  if (options?.maxSize || MAX_FILE_SIZE) {
    validators.push(
      new MaxFileSizeValidator({
        maxSize: options?.maxSize || MAX_FILE_SIZE,
      }),
    );
  }

  if (options?.fileType || ALLOWED_IMAGE_TYPES) {
    validators.push(
      new FileTypeValidator({
        fileType: (options?.fileType as string) || ALLOWED_IMAGE_TYPES,
      }),
    );
  }

  return new ParseFilePipe({
    validators,
    fileIsRequired: options?.required ?? true,
  });
}

/**
 * Universal File Validation Pipe.
 * Automatically handles:
 * - Single File (@UploadedFile())
 * - Multiple Files (@UploadedFiles() from FilesInterceptor)
 * - Multiple Fields (@UploadedFiles() from FileFieldsInterceptor)
 */
@Injectable()
export class FileFieldsValidationPipe implements PipeTransform {
  constructor(
    private readonly options?:
      | FileFieldValidationOptions
      | {
          maxSize?: number;
          fileType?: string | RegExp;
          required?: boolean;
        },
  ) {}

  async transform(value: unknown) {
    if (!value) {
      if ((this.options as Record<string, unknown>)?.required) {
        throw new BadRequestException('File is required');
      }
      return value;
    }

    // Case 1: Multiple named fields (Object of arrays from FileFieldsInterceptor)
    if (
      typeof value === 'object' &&
      !(value as Record<string, unknown>).buffer &&
      !Array.isArray(value)
    ) {
      const optionsMap = this.options as FileFieldValidationOptions;
      const filesObject = value as Record<string, Express.Multer.File[]>;

      for (const fieldName in optionsMap) {
        const fieldFiles = filesObject[fieldName];
        const config = optionsMap[fieldName];

        if (config.required && (!fieldFiles || fieldFiles.length === 0)) {
          throw new BadRequestException(`Field "${fieldName}" is required`);
        }

        if (fieldFiles && fieldFiles.length > 0) {
          const pipe = createFileValidationPipe(config);
          for (const file of fieldFiles) {
            await pipe.transform(file);
          }
        }
      }
      return value;
    }

    // Case 2: Single file or Array of files
    const pipe = createFileValidationPipe(
      this.options as Record<string, unknown>,
    );
    if (Array.isArray(value)) {
      for (const file of value as Express.Multer.File[]) {
        await pipe.transform(file);
      }
    } else {
      await pipe.transform(value as Express.Multer.File);
    }

    return value;
  }
}
