import { Role } from '@/commons/enums/app.enum';
import { UpdateProfileDto } from './dtos/create-user.dto';
import { ForbiddenException, Injectable, OnModuleInit } from '@nestjs/common';
import { LoggerService } from '@/commons/logger/logger.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService as BetterAuthService } from '@thallesp/nestjs-better-auth';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '@/services/storage/storage.service';
import { User } from '@/modules/auth/entities/user.entity';

import { StoragePath } from '@/services/storage/storage.enums';

export interface RegistrationUserData {
  email: string;
  password: string;
  name: string;
  otp: string;
  createdAt: number;
}

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly loggerService = new LoggerService(UsersService.name);

  constructor(
    @InjectRepository(User)
    public usersRepository: Repository<User>,
    public betterAuthService: BetterAuthService,
    private configService: ConfigService,
    private storageService: StorageService,
  ) {}

  async onModuleInit() {
    await this.syncAdmin();
  }

  /**
   * Gets the user profile by ID.
   */
  async getProfile(userId: string) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['media'],
    });

    if (user && user.media) {
      user.media.url =
        (await this.storageService.getPresignedUrl(user.media.s3Key)) ||
        user.media.url;
    }

    return user;
  }

  /**
   * Updates the user profile.
   */
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
    file?: Express.Multer.File,
  ) {
    const user = await this.getProfile(userId);
    const oldMediaId = user?.mediaId;
    const updateData: Partial<User> = {};

    if (dto.name) updateData.name = dto.name;
    if (dto.phone !== undefined)
      updateData.phoneNumber = dto.phone === '' ? null : dto.phone;

    if (file) {
      const media = await this.storageService.uploadFile(
        file,
        true,
        StoragePath.USERS_AVATAR,
      );
      updateData.mediaId = media.id;
      updateData.image = '';
    }

    if (Object.keys(updateData).length > 0) {
      await this.usersRepository.update(userId, updateData);
    }

    if (file && oldMediaId) {
      void this.storageService.deleteFile(oldMediaId);
    }

    return this.getProfile(userId);
  }

  /**
   * Synchronizes the admin user from environment variables.
   */
  private async syncAdmin() {
    const adminEmail = this.configService.get<string>('ADMIN_EMAIL');
    const adminPassword = this.configService.get<string>('ADMIN_PASSWORD');

    if (!adminEmail || !adminPassword) {
      this.loggerService.warn(
        'ADMIN_EMAIL or ADMIN_PASSWORD not set. Skipping admin sync.',
      );
      return;
    }

    try {
      const adminExists = await this.usersRepository.findOne({
        where: { email: adminEmail },
      });

      if (!adminExists) {
        const result = await this.betterAuthService.api.signUpEmail({
          body: {
            name: 'System Admin',
            email: adminEmail,
            password: adminPassword,
          },
        });

        await this.usersRepository.update(result.user.id, {
          role: Role.ADMIN,
          emailVerified: true,
        });
      } else if (adminExists.role !== Role.ADMIN) {
        await this.usersRepository.update(adminExists.id, {
          role: Role.ADMIN,
        });
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.loggerService.error(`Failed to sync admin: ${errorMessage}`);
    }
  }

  /**
   * Creates the first admin user in the system.
   */
  public async createFirstAdmin(email: string, password: string) {
    if (
      (await this.usersRepository.count({ where: { role: Role.ADMIN } })) > 0
    ) {
      throw new ForbiddenException();
    }

    const result = await this.betterAuthService.api.signUpEmail({
      body: { name: 'Admin', email, password },
    });

    await this.usersRepository.update(result.user.id, {
      role: Role.ADMIN,
      emailVerified: true,
    });

    return this.betterAuthService.api.signInEmail({
      body: { email, password },
    });
  }
}
