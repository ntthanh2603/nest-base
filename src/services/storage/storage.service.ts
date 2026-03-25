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
  private readonly bucket: string;

  constructor(
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
    private readonly kafkaService: KafkaService,
    private readonly configService: ConfigService,
  ) {
    /**
     * Initialize S3 bucket name from environment or default to 'media'
     */
    this.bucket = this.configService.get<string>('S3_BUCKET', 'media')!;

    /**
     * Configure S3 Client.
     * Use S3_ENDPOINT for custom providers (SeaweedFS, Minio).
     * Leave S3_ENDPOINT empty for standard AWS S3.
     */
    const endpoint = this.configService.get<string>('S3_ENDPOINT');
    this.s3Client = new S3Client({
      endpoint: endpoint || undefined,
      region: this.configService.get<string>('S3_REGION', 'us-east-1'),
      credentials: {
        accessKeyId: this.configService.get<string>('S3_ACCESS_KEY', ''),
        secretAccessKey: this.configService.get<string>('S3_SECRET_KEY', ''),
      },
      forcePathStyle: this.configService.get<boolean>(
        'S3_FORCE_PATH_STYLE',
        true,
      ),
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
    isSync = false,
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

    const publicUrlBase = this.configService.get<string>(
      'S3_PUBLIC_URL',
      `http://localhost:8888/buckets/${this.bucket}`,
    );
    const publicUrl = `${publicUrlBase}/${key}`;

    // 3. Create a PENDING record in the database
    const media = this.mediaRepository.create({
      filename,
      originalName: file.originalname,
      mimeType: mimeType,
      size: processedBuffer.length, // Store the optimized size
      status: MediaStatus.PENDING,
      s3Key: key,
      url: publicUrl,
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

        return { ...savedMedia, status: MediaStatus.COMPLETED };
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
    await this.mediaRepository.remove(media);
  }

  /**
   * Generates a pre-signed URL for a specific file key.
   * Useful for private buckets or time-limited access.
   *
   * @param key The S3 key of the object.
   * @param expiresIn Expiration time in seconds (default: 1 hour).
   * @returns The signed URL string.
   */
  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn });
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

      // Construct public URL using the configured public base URL
      const publicUrlBase = this.configService.get<string>(
        'S3_PUBLIC_URL',
        `http://localhost:8888/buckets/${this.bucket}`,
      );
      const url = `${publicUrlBase}/${key}`;

      // Update the record with completion details
      await this.mediaRepository.update(mediaId, {
        s3Key: key,
        url,
        status: MediaStatus.COMPLETED,
      });
    } catch (error) {
      this.logger.error(`Async upload failed for mediaId: ${mediaId}`, error);
      await this.mediaRepository.update(mediaId, {
        status: MediaStatus.FAILED,
      });
    }
  }
}
