import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Media, MediaStatus } from './entities/media.entity';
import { KafkaService } from '../kafka/kafka.service';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';
import * as sharp from 'sharp';
import * as path from 'path';
import { StoragePath } from './storage.enums';

interface StorageUploadMessage {
  mediaId: string;
  fileBuffer: string;
  mimeType: string;
  filename: string;
  folder: string;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client;
  private signingClient: S3Client;
  private readonly bucket: string;

  constructor(
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
    private readonly kafkaService: KafkaService,
    private readonly configService: ConfigService,
  ) {
    /**
     * Initialize S3 bucket name from environment or default to 'medias'
     */
    this.bucket = this.configService.get<string>('S3_BUCKET', 'medias')!;

    /**
     * Configure S3 Clients.
     * s3Client: Used for internal operations (upload, delete)
     * signingClient: Used for generating public-facing presigned URLs
     */
    const endpoint = this.configService.get<string>('S3_ENDPOINT');
    const externalUrl =
      this.configService.get<string>('S3_EXTERNAL_URL') || endpoint;
    const region = this.configService.get<string>('S3_REGION', 'us-east-1');
    const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY', '');
    const secretAccessKey = this.configService.get<string>('S3_SECRET_KEY', '');
    const forcePathStyle =
      this.configService.get<string>('S3_FORCE_PATH_STYLE', 'true') !== 'false';

    const commonConfig = {
      region,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle,
      requestChecksumCalculation: 'WHEN_REQUIRED' as const,
      responseChecksumValidation: 'WHEN_REQUIRED' as const,
    };

    this.s3Client = new S3Client({
      ...commonConfig,
      endpoint: (endpoint as string) || undefined,
    });

    this.signingClient = new S3Client({
      ...commonConfig,
      endpoint: (externalUrl as string) || undefined,
    });
  }

  onModuleInit() {
    // Start Kafka consumer in background - Not await so NestJS startup is not blocked
    this.kafkaService
      .consume('storage-upload', 'storage-group', async ({ message }) => {
        if (!message.value) {
          return;
        }

        try {
          const { mediaId, fileBuffer, mimeType, filename, folder } =
            JSON.parse(message.value.toString()) as StorageUploadMessage;
          await this.processUpload(
            mediaId,
            Buffer.from(fileBuffer, 'base64'),
            mimeType,
            filename,
            folder,
          );
        } catch (err) {
          this.logger.error('Error parsing Kafka message', err);
        }
      })
      .catch((error) => {
        this.logger.error(
          'Failed to start Storage Kafka consumer in background',
          error,
        );
      });
  }

  /**
   * Main upload function that handles both synchronous and asynchronous (Kafka) flows.
   *
   * @param file The file object containing buffer, name, and mime type.
   * @param isSync If true, the file is uploaded directly to S3 and waits for completion.
   *               If false, the file metadata is saved and the upload is offloaded to Kafka.
   * @param folder Optional folder path in the bucket to organize files.
   * @returns The media record from the database.
   */
  async uploadFile(
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
    isSync = true,
    folder: string | StoragePath = StoragePath.UPLOADS,
  ) {
    // 0. Clean the folder path (remove leading/trailing slashes)
    const cleanFolder = folder.replace(/^\/+|\/+$/g, '');
    // 1. Validate file type (Currently restricted to images)
    if (!file.mimetype.startsWith('image/')) {
      throw new Error('Only image files are allowed');
    }

    /**
     * OPTIMIZATION: Process image with Sharp
     * 1. Resize: Limit maximum dimensions to 2000px (width or height) to avoid oversized images.
     * 2. Convert to WebP: Significant size reduction with good quality.
     */
    const processedBuffer = await sharp(file.buffer)
      .resize(2000, 2000, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer();

    // 2. Prepare file names and paths (Always use .webp extension)
    const originalNameWithoutExt = path.parse(file.originalname).name;
    const filename = `${Date.now()}-${originalNameWithoutExt}.webp`;
    const key = cleanFolder ? `${cleanFolder}/${filename}` : filename;
    const mimeType = 'image/webp';

    // 3. Create a PENDING record in the database
    const media = this.mediaRepository.create({
      filename,
      originalName: file.originalname,
      mimeType: mimeType,
      size: processedBuffer.length, // Store the optimized size
      status: MediaStatus.PENDING,
      s3Key: key,
      url: '', // Default URL to empty, must be retrieved via getPresignedUrl
    });

    const savedMedia = await this.mediaRepository.save(media);

    if (isSync) {
      /**
       * SYNCHRONOUS FLOW:
       * Upload the file immediately and wait for S3 response.
       * Best for small files like avatars where immediate consistency is required.
       */
      try {
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: processedBuffer,
            ContentType: mimeType,
          }),
        );

        // Mark as completed in the database
        await this.mediaRepository.update(savedMedia.id, {
          status: MediaStatus.COMPLETED,
        });

        const completedMedia = Object.assign(savedMedia, {
          status: MediaStatus.COMPLETED,
          url: (await this.getPresignedUrl(key)) || '',
        });
        return completedMedia;
      } catch (error) {
        // Log the error and mark as failed
        this.logger.error(`Synchronous upload failed for ${filename}`, error);
        await this.mediaRepository.update(savedMedia.id, {
          status: MediaStatus.FAILED,
        });
        throw error;
      }
    } else {
      /**
       * ASYNCHRONOUS FLOW:
       * Produce a message to Kafka. High performance, no waiting for S3.
       * Best for large file uploads or batch processing.
       */
      await this.kafkaService.produce('storage-upload', [
        {
          value: JSON.stringify({
            mediaId: savedMedia.id,
            fileBuffer: processedBuffer.toString('base64'),
            mimeType: mimeType,
            filename,
            folder: cleanFolder,
          }),
        },
      ]);

      return savedMedia;
    }
  }

  /**
   * Deletes a file from both the S3 storage and the database record.
   *
   * @param mediaId The UUID of the media record to delete.
   */
  async deleteFile(mediaId: string) {
    const media = await this.mediaRepository.findOne({
      where: { id: mediaId },
    });

    if (!media) {
      return;
    }

    // Remove the object from S3 storage if the key exists
    if (media.s3Key) {
      try {
        await this.s3Client.send(
          new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: media.s3Key,
          }),
        );
      } catch (error) {
        this.logger.error(
          `Failed to delete S3 object for mediaId: ${mediaId}`,
          error,
        );
      }
    }

    // Permanently remove the metadata record from the database
    try {
      await this.mediaRepository.remove(media);
    } catch (error: unknown) {
      const dbError = error as { code?: string };
      if (dbError.code === '23503') {
        this.logger.warn(
          `Could not delete media record ${mediaId} because it is still referenced by another table. Metadata will remain but file content may have been removed.`,
        );
      } else {
        throw error;
      }
    }
  }

  /**
   * Background task triggered by Kafka to process queued uploads.
   *
   * @param mediaId Reference to the DB record.
   * @param buffer The actual file content.
   * @param mimeType The file's mime type.
   * @param filename Unique file name.
   */
  private async processUpload(
    mediaId: string,
    buffer: Buffer,
    mimeType: string,
    filename: string,
    folder: string,
  ) {
    try {
      // Construct key for update
      const cleanFolder = folder.replace(/^\/+|\/+$/g, '');
      const key = cleanFolder ? `${cleanFolder}/${filename}` : filename;

      // Upload to SeaweedFS via S3 interface
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
        }),
      );

      // Update the record with completion details
      await this.mediaRepository.update(mediaId, {
        s3Key: key,
        url: '', // Keep url empty, as it should be signed on retrieval
        status: MediaStatus.COMPLETED,
      });
    } catch (error) {
      this.logger.error(`Async upload failed for mediaId: ${mediaId}`, error);
      await this.mediaRepository.update(mediaId, {
        status: MediaStatus.FAILED,
      });
    }
  }

  /**
   * Generates a temporary, signed URL for a file stored in S3.
   * This is the recommended secure way to serve private files.
   *
   * @param key The S3 key of the object.
   * @param expiresInSeconds Duration in seconds for the link to remain valid (default 1 hour).
   * @returns A promise that resolves to the signed URL.
   */
  async getPresignedUrl(
    key: string | null | undefined,
    expiresInSeconds = 3600,
  ): Promise<string | null> {
    if (!key) {
      return null;
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      return await getSignedUrl(this.signingClient, command, {
        expiresIn: expiresInSeconds,
      });
    } catch (error) {
      this.logger.error(
        `Failed to generate presigned URL for key: ${key}`,
        error,
      );
      return null;
    }
  }
}
