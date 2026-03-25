import { Role, UserStatus } from '@/commons/enums/app.enum';
import {
  UserRegisterDto,
  UserVerifyOtpDto,
  UserResendOtpDto,
  UpdateProfileDto,
} from './dtos/create-user.dto';
import { DefaultMessageResponseDto } from '@/commons/dtos/default-message-response.dto';
import { ForbiddenException, Injectable, OnModuleInit } from '@nestjs/common';
import { LoggerService } from '@/commons/logger/logger.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService as BetterAuthService } from '@thallesp/nestjs-better-auth';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@/services/redis/redis.service';
import { MailService } from '@/services/mail/mail.service';
import { StorageService } from '@/services/storage/storage.service';
import { User } from '@/modules/auth/entities/user.entity';

import {
  getRegistrationUserKey,
  getOtpAttemptsKey,
  getRegistrationRateLimitKey,
} from '@/utils/key-redis';
import { generate6DigitOtp } from '@/utils/otp.util';

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
  private readonly OTP_EXPIRY_SECONDS = 300; // 5 minutes
  private readonly REGISTRATION_USER_EXPIRY_SECONDS = 1800; // 30 minutes

  constructor(
    @InjectRepository(User)
    public usersRepository: Repository<User>,
    public betterAuthService: BetterAuthService,
    private configService: ConfigService,
    private redisService: RedisService,
    private mailService: MailService,
    private storageService: StorageService,
  ) {}

  async onModuleInit() {
    await this.syncAdmin();
  }


  /**
   * Gets the user profile by ID.
   */
  async getProfile(userId: string) {
    return this.usersRepository.findOne({
      where: { id: userId },
      relations: ['media'],
    });
  }

  /**
   * Updates the user profile.
   */
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
    file?: Express.Multer.File,
  ) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['media'],
    });

    const updateData: Partial<User> = {};

    if (dto.name) updateData.name = dto.name;
    if (dto.phone !== undefined)
      updateData.phone = dto.phone === '' ? null : dto.phone;
    if (dto.address !== undefined)
      updateData.address = dto.address === '' ? null : dto.address;
    if (dto.cccd !== undefined)
      updateData.cccd = dto.cccd === '' ? null : dto.cccd;

    if (dto.dateOfBirth !== undefined) {
      if (dto.dateOfBirth === '') {
        updateData.dateOfBirth = null;
      } else {
        const date = new Date(dto.dateOfBirth);
        updateData.dateOfBirth = isNaN(date.getTime()) ? null : date;
      }
    }

    if (file) {
      const oldMediaId = user?.mediaId;
      const media = await this.storageService.uploadFile(file);
      updateData.mediaId = media.id;
      updateData.image = '';

      if (oldMediaId) {
        void this.storageService.deleteFile(oldMediaId);
      }
    }

    if (Object.keys(updateData).length > 0) {
      await this.usersRepository.update(userId, updateData);
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

  /**
   * Registers a new user.
   */
  async register(dto: UserRegisterDto): Promise<DefaultMessageResponseDto> {
    const { email: rawEmail, password, name } = dto;
    const email = rawEmail.trim().toLowerCase();

    // 1. Check if user already exists in DB
    const existingUser = await this.usersRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      if (existingUser.emailVerified) {
        return {
          message: 'Email already registered. Please login or reset password.',
        };
      }
      // If user exists but not verified in DB, we could either allow them to re-initiate
      // or redirect to general verification. For this Redis flow, we'll allow re-initiating.
      this.loggerService.warn(
        `User ${email} exists in DB but not verified. Re-initiating via Redis flow.`,
      );
    }

    // 2. Rate limit check
    const rateLimitKey = getRegistrationRateLimitKey(email);
    const count = await this.redisService.incr(rateLimitKey);
    if (count === 1) await this.redisService.expire(rateLimitKey, 60);
    if (count > 5) {
      return {
        message:
          'Too many registration requests. Please try again in 1 minute.',
      };
    }

    // 3. Check if already has a record in Redis
    const userKey = getRegistrationUserKey(email);
    const hasRedisData = await this.redisService.get(userKey);
    if (hasRedisData) {
      return {
        message:
          'Registration exists. Please check your email for OTP or request a new one.',
      };
    }

    // 4. Create registration record and send OTP
    const otp = generate6DigitOtp();
    const registrationData: RegistrationUserData = {
      email,
      password,
      name,
      otp,
      createdAt: Date.now(),
    };

    try {
      await this.redisService.setex(
        userKey,
        this.REGISTRATION_USER_EXPIRY_SECONDS,
        JSON.stringify(registrationData),
      );
      await this.redisService.setex(
        getOtpAttemptsKey(email),
        this.OTP_EXPIRY_SECONDS,
        '0',
      );

      const sent = await this.mailService.sendOtp(
        email,
        otp,
        this.OTP_EXPIRY_SECONDS / 60,
      );
      if (!sent) {
        return {
          message: 'Failed to send verification OTP. Please try again.',
        };
      }

      return {
        message:
          'Registration initiated. Please check your email for verification OTP.',
      };
    } catch (error) {
      this.loggerService.error(`Register error for ${email}: ${error}`);
      return { message: 'Failed to initiate registration. Please try again.' };
    }
  }

  /**
   * Verifies the OTP and completes user registration.
   */
  async verifyRegistration(
    dto: UserVerifyOtpDto,
  ): Promise<DefaultMessageResponseDto> {
    const { email: rawEmail, otp } = dto;
    const email = rawEmail.trim().toLowerCase();
    const userKey = getRegistrationUserKey(email);
    const attemptsKey = getOtpAttemptsKey(email);

    try {
      // 1. Get registration data from Redis
      const dataStr = await this.redisService.get(userKey);
      if (!dataStr) {
        return {
          message: 'Registration session expired. Please register again.',
        };
      }
      const registrationData = JSON.parse(dataStr) as RegistrationUserData;

      // 2. Check OTP expiry
      if (
        Date.now() - registrationData.createdAt >
        this.OTP_EXPIRY_SECONDS * 1000
      ) {
        await Promise.all([
          this.redisService.del(userKey),
          this.redisService.del(attemptsKey),
        ]);
        return { message: 'OTP has expired. Please request a new one.' };
      }

      // 3. Validate OTP
      if (registrationData.otp !== otp) {
        const attempts = await this.redisService.get(attemptsKey);
        const attemptCount = (attempts ? parseInt(attempts, 10) : 0) + 1;
        await this.redisService.setex(
          attemptsKey,
          this.OTP_EXPIRY_SECONDS,
          attemptCount.toString(),
        );

        if (attemptCount >= 5) {
          await this.redisService.del(userKey);
          return {
            message: 'Too many failed attempts. Please register again.',
          };
        }
        return {
          message: `Invalid OTP. ${5 - attemptCount} attempts remaining.`,
        };
      }

      // 4. Complete registration in DB
      const result = await this.betterAuthService.api.signUpEmail({
        body: {
          name: registrationData.name,
          email: registrationData.email,
          password: registrationData.password,
        },
      });

      if (result.user) {
        await this.usersRepository.update(result.user.id, {
          name: registrationData.name,
          emailVerified: true,
          status: UserStatus.ACTIVE,
          role: Role.USER,
        });
        this.loggerService.log(`User registered and verified: ${email}`);
      } else {
        throw new Error('User creation failed unexpectedly');
      }

      // 5. Cleanup Redis
      await Promise.all([
        this.redisService.del(userKey),
        this.redisService.del(attemptsKey),
      ]);

      return {
        message: 'Registration completed successfully. You can now login.',
      };
    } catch (error) {
      this.loggerService.error(`Verify error for ${email}: ${error}`);
      return { message: 'Failed to complete registration. Please try again.' };
    }
  }

  /**
   * Resends the OTP for pending registration.
   */
  async resendRegistrationOtp(
    dto: UserResendOtpDto,
  ): Promise<DefaultMessageResponseDto> {
    const { email: rawEmail } = dto;
    const email = rawEmail.trim().toLowerCase();
    const userKey = getRegistrationUserKey(email);

    // 1. Rate limit check
    const rateLimitKey = getRegistrationRateLimitKey(email);
    const count = await this.redisService.incr(rateLimitKey);
    if (count === 1) await this.redisService.expire(rateLimitKey, 60);
    if (count > 5)
      return { message: 'Too many requests. Please try again in 1 minute.' };

    try {
      // 2. Check if registration exists
      const dataStr = await this.redisService.get(userKey);
      if (!dataStr) {
        return { message: 'No registration found. Please register again.' };
      }
      const registrationData = JSON.parse(dataStr) as RegistrationUserData;

      // 3. Generate and send new OTP
      const newOtp = generate6DigitOtp();
      const sent = await this.mailService.sendOtp(
        email,
        newOtp,
        this.OTP_EXPIRY_SECONDS / 60,
      );
      if (!sent) return { message: 'Failed to resend OTP. Please try again.' };

      // 4. Update Redis
      registrationData.otp = newOtp;
      registrationData.createdAt = Date.now();
      await this.redisService.setex(
        userKey,
        this.REGISTRATION_USER_EXPIRY_SECONDS,
        JSON.stringify(registrationData),
      );
      await this.redisService.setex(
        getOtpAttemptsKey(email),
        this.OTP_EXPIRY_SECONDS,
        '0',
      );

      this.loggerService.log(`Registration OTP resent to: ${email}`);
      return {
        message:
          'Verification OTP resent successfully. Please check your email.',
      };
    } catch (error) {
      this.loggerService.error(`Resend error for ${email}: ${error}`);
      return { message: 'Failed to resend OTP. Please try again.' };
    }
  }
}
