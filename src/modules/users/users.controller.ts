import { Controller, UploadedFile, Body, Get, Patch } from '@nestjs/common';
import { UsersService } from './users.service';
import { Roles, Session } from '@thallesp/nestjs-better-auth';
import { ApiTags } from '@nestjs/swagger';
import { ALL_ROLES } from '@/commons/enums/app.enum';
import { Doc } from '@/commons/docs/doc.decorator';
import { User } from '@/modules/auth/entities/user.entity';
import { UpdateProfileDto } from './dtos/create-user.dto';
import { ApiFile } from '@/commons/decorators/file-upload.decorator';
import { FileFieldsValidationPipe } from '@/commons/pipes/file-validation.pipe';
import {
  ALLOWED_IMAGE_TYPES,
  MAX_FILE_SIZE,
} from '@/commons/constants/app.constants';

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
  async getMe(@Session() { user }: { user: User }) {
    return this.usersService.getProfile(user.id);
  }

  @Patch('me')
  @Roles(ALL_ROLES)
  @Doc({
    summary: 'Role: All - Update profile & avatar',
    description:
      'Update user info and avatar using a combined IntersectionType DTO.',
    response: { serialization: User },
  })
  @ApiFile('avatar', UpdateProfileDto)
  async updateMe(
    @Session() { user }: { user: User },
    @Body() dto: UpdateProfileDto,
    @UploadedFile(
      new FileFieldsValidationPipe({
        maxSize: MAX_FILE_SIZE,
        fileType: ALLOWED_IMAGE_TYPES,
        required: false,
      }),
    )
    file?: Express.Multer.File,
  ) {
    return this.usersService.updateProfile(user.id, dto, file);
  }
}
