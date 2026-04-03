import {
  ApiProperty,
  ApiPropertyOptional,
  IntersectionType,
} from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';

/**
 * DTO for initiating user registration.
 */
export class UserRegisterDto {
  @ApiProperty({ description: 'User email', example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'User password', minLength: 8 })
  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  password: string;

  @ApiProperty({ description: 'User full name', example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  name: string;
}

/**
 * DTO for verifying registration via OTP.
 */
export class UserVerifyOtpDto {
  @ApiProperty({ description: 'User email', example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'OTP code', example: '123456' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d+$/)
  otp: string;
}

/**
 * DTO for resending registration OTP.
 */
export class UserResendOtpDto {
  @ApiProperty({ description: 'User email', example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

/**
 * DTO for logging in via Email.
 */
export class LoginEmailDto {
  @ApiProperty({ description: 'Email address', example: 'admin@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'User password' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional({ description: 'Stay logged in', default: true })
  @IsOptional()
  rememberMe?: boolean;
}

/**
 * DTO for forgot password request.
 */
export class ForgotPasswordDto {
  @ApiProperty({ description: 'User email', example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

/**
 * DTO for resetting password via token.
 */
export class ResetPasswordDto {
  @ApiProperty({ description: 'New password', minLength: 8 })
  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  newPassword: string;

  @ApiProperty({ description: 'Reset token from email' })
  @IsString()
  @IsNotEmpty()
  token: string;
}

/**
 * DTO for updating user profile.
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'Full name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: 'Address' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ description: 'Date of birth' })
  @IsString()
  @IsOptional()
  dateOfBirth?: string;

  @ApiPropertyOptional({ description: 'Identity Card Number' })
  @IsString()
  @IsOptional()
  cccd?: string;
}

/**
 * DTO for upload file (avatar)
 */
export class FileDto {
  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'User avatar file',
  })
  avatar: unknown;
}

/**
 * Combined DTO for updating user profile with avatar upload.
 * Uses IntersectionType for clean Swagger documentation.
 */
export class UpdateProfileWithAvatarDto extends IntersectionType(
  UpdateProfileDto,
  FileDto,
) {}
