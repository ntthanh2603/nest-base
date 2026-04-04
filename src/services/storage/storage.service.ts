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
import sharp from 'sharp';
import * as path from 'path';
import { StoragePath } from './storage.enums';

interface StorageUploadMessage {
  mediaId: string;
  fileUrl: string;
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
    this.bucket = this.configService.get<string>('S3_BUCKET', 'medias')!;

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
    this.kafkaService
      .consume('storage-upload', 'storage-group', async ({ message }) => {
        if (!message.value) {
          return;
        }

        try {
          const { mediaId, fileUrl, mimeType, filename, folder } = JSON.parse(
            message.value.toString(),
          ) as StorageUploadMessage;
          const response = await fetch(fileUrl);
          if (!response.ok) {
            throw new Error(
              `Failed to fetch file from presigned URL: ${response.statusText}`,
            );
          }
          const arrayBuffer = await response.arrayBuffer();
          await this.processUpload(
            mediaId,
            Buffer.from(arrayBuffer),
            mimeType,
            filename,
            folder,
          );
        } catch (err) {
          this.logger.error('Error processing Kafka message', err);
        }
      })
      .catch((error) => {
        this.logger.error(
          'Failed to start Storage Kafka consumer in background',
          error,
        );
      });
  }

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
    const cleanFolder = folder.replace(/^\/+|\/+$/g, '');

    if (!file.mimetype.startsWith('image/')) {
      throw new Error('Only image files are allowed');
    }

    const processedBuffer = await sharp(file.buffer)
      .resize(2000, 2000, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer();

    const originalNameWithoutExt = path.parse(file.originalname).name;
    const filename = `${Date.now()}-${originalNameWithoutExt}.webp`;
    const key = cleanFolder ? `${cleanFolder}/${filename}` : filename;
    const mimeType = 'image/webp';

    const media = this.mediaRepository.create({
      filename,
      originalName: file.originalname,
      mimeType: mimeType,
      size: processedBuffer.length,
      status: MediaStatus.PENDING,
      s3Key: key,
      url: '',
    });

    const savedMedia = await this.mediaRepository.save(media);

    if (isSync) {
      try {
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: processedBuffer,
            ContentType: mimeType,
          }),
        );

        await this.mediaRepository.update(savedMedia.id, {
          status: MediaStatus.COMPLETED,
        });

        const completedMedia = Object.assign(savedMedia, {
          status: MediaStatus.COMPLETED,
          url: (await this.getPresignedUrl(key)) || '',
        });
        return completedMedia;
      } catch (error) {
        this.logger.error(`Synchronous upload failed for ${filename}`, error);
        await this.mediaRepository.update(savedMedia.id, {
          status: MediaStatus.FAILED,
        });
        throw error;
      }
    } else {
      const presignedPutUrl = await getSignedUrl(
        this.s3Client,
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          ContentType: mimeType,
        }),
        { expiresIn: 3600 },
      );

      await this.kafkaService.produce('storage-upload', [
        {
          value: JSON.stringify({
            mediaId: savedMedia.id,
            fileUrl: presignedPutUrl,
            mimeType: mimeType,
            filename,
            folder: cleanFolder,
          }),
        },
      ]);

      return savedMedia;
    }
  }

  async deleteFile(mediaId: string) {
    const media = await this.mediaRepository.findOne({
      where: { id: mediaId },
    });

    if (!media) {
      return;
    }

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

      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
        }),
      );

      await this.mediaRepository.update(mediaId, {
        s3Key: key,
        url: '',
        status: MediaStatus.COMPLETED,
      });
    } catch (error) {
      this.logger.error(`Async upload failed for mediaId: ${mediaId}`, error);
      await this.mediaRepository.update(mediaId, {
        status: MediaStatus.FAILED,
      });
    }
  }

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
