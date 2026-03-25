import {
  Controller,
  ParseFilePipe,
  UploadedFile,
  UseInterceptors,
  MaxFileSizeValidator,
  FileTypeValidator,
  Post,
  HttpCode,
  HttpStatus,
  Body,
  Get,
  Patch,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { AllowAnonymous, Roles, Session } from '@thallesp/nestjs-better-auth';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { ALL_ROLES } from '@/commons/enums/app.enum';
import { Doc } from '@/commons/docs/doc.decorator';
import { User } from '@/modules/auth/entities/user.entity';
import {
  UserRegisterDto,
  UserVerifyOtpDto,
  UserResendOtpDto,
  UpdateProfileDto,
  UpdateProfileWithAvatarDto,
} from './dtos/create-user.dto';
import { DefaultMessageResponseDto } from '@/commons/dtos/default-message-response.dto';
import { RateLimit } from '@/commons/decorators/rate-limit.decorator';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @Roles(ALL_ROLES)
  @Doc({
    summary: 'Role: All - Get current user profile',
    description: 'Get the profile of the currently logged in user.',
    response: { serialization: User },
  })
  async getMe(@Session() user: User) {
    return this.usersService.getProfile(user.id);
  }

  @Patch('me')
  @Roles(ALL_ROLES)
  @ApiBody({ type: UpdateProfileWithAvatarDto })
  @UseInterceptors(FileInterceptor('avatar'))
  @Doc({
    summary: 'Role: All - Update profile & avatar',
    description:
      'Update user info and avatar using a combined IntersectionType DTO.',
    request: { bodyType: 'FORM_DATA' },
    response: { serialization: User },
  })
  async updateMe(
    @Session() user: User,
    @Body() dto: UpdateProfileDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg|webp)' }),
        ],
        fileIsRequired: false,
      }),
    )
    file?: Express.Multer.File,
  ) {
    return this.usersService.updateProfile(user.id, dto, file);
  }

  @AllowAnonymous()
  @RateLimit({ limit: 1, ttl: 60 })
  @Post('register')
  @HttpCode(HttpStatus.OK)
  @Doc({
    summary: 'Role: None - Register a new user',
    description:
      'Create a pending user registration. User data is stored in Redis until email verification is completed.',
    response: { serialization: DefaultMessageResponseDto },
  })
  async register(
    @Body() dto: UserRegisterDto,
  ): Promise<DefaultMessageResponseDto> {
    return this.usersService.register(dto);
  }

  @AllowAnonymous()
  @RateLimit({ limit: 5, ttl: 60 })
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @Doc({
    summary: 'Role: None - Verify OTP and complete registration',
    description:
      'Verify the OTP sent to email and create the user account in database.',
    response: { serialization: DefaultMessageResponseDto },
  })
  async verifyOtp(
    @Body() dto: UserVerifyOtpDto,
  ): Promise<DefaultMessageResponseDto> {
    return this.usersService.verifyRegistration(dto);
  }

  @AllowAnonymous()
  @RateLimit({ limit: 1, ttl: 60 })
  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @Doc({
    summary: 'Role: None - Resend OTP for pending registration',
    description:
      'Resend the verification OTP to the email for pending registration.',
    response: { serialization: DefaultMessageResponseDto },
  })
  async resendOtp(
    @Body() dto: UserResendOtpDto,
  ): Promise<DefaultMessageResponseDto> {
    return this.usersService.resendRegistrationOtp(dto);
  }
}
