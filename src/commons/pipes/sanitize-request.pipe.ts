import {
  Injectable,
  PipeTransform,
  ArgumentMetadata,
} from '@nestjs/common';

/**
 * Global Pipe to sanitize request data.
 * Automatically converts empty strings ('') and the string 'null' to undefined.
 * Since Pipes run AFTER Interceptors (like FileInterceptor), this effectively
 * cleans up the body populated by Multer before validation occurs.
 */
@Injectable()
export class SanitizeRequestPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    // Only sanitize body payloads
    if (metadata.type === 'body' && value && typeof value === 'object') {
      return this.sanitize(value);
    }
    return value;
  }

  private sanitize(obj: unknown): unknown {
    if (Array.isArray(obj)) {
      return obj.map((v: unknown) => this.sanitize(v));
    }

    if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
      // Safely check for 'buffer' property to skip Multer File objects
      if ('buffer' in obj) {
        return obj;
      }

      const record = obj as Record<string, unknown>;
      Object.keys(record).forEach((key) => {
        const val = record[key];

        if (val === '' || val === 'null') {
          record[key] = undefined;
        } else if (val !== null && typeof val === 'object') {
          record[key] = this.sanitize(val);
        }
      });
    }

    return obj;
  }
}
