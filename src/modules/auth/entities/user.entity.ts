import { BaseEntity } from '@/commons/entities/base.entity';
import { Role } from '@/commons/enums/app.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, OneToMany } from 'typeorm';
import { Account } from './account.entity';
import { Session } from './session.entity';
import { Media } from '@/services/storage/entities/media.entity';
import { JoinColumn, OneToOne } from 'typeorm';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

@Entity('user')
export class User extends BaseEntity {
  @ApiPropertyOptional({ description: 'Name of the user' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  @Column({ type: 'varchar', length: 200, nullable: true })
  name?: string | null;

  @ApiPropertyOptional({
    description: 'Phone number of the user',
    example: '0901234567',
  })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  @Column({ type: 'varchar', length: 20, nullable: true, unique: true })
  phoneNumber?: string | null;

  @ApiProperty({ description: 'Email of the user' })
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'boolean' })
  @IsBoolean()
  @IsOptional()
  emailVerified: boolean;

  @Column({ type: 'text', nullable: true })
  @IsString()
  @IsOptional()
  image?: string;

  @ApiPropertyOptional({ description: 'ID of the avatar media' })
  @IsUUID()
  @IsOptional()
  @Column({ type: 'uuid', nullable: true })
  mediaId?: string | null;

  @ApiPropertyOptional({ type: () => Media })
  @OneToOne(() => Media, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'mediaId' })
  media?: Media;

  @ApiProperty({ enum: Role, enumName: 'Role' })
  @IsEnum(Role)
  @IsOptional()
  @Column({ type: 'enum', enum: Role, default: Role.USER })
  role: Role;

  @Column({ type: 'text', default: 'en' })
  @IsString()
  @IsOptional()
  language: string;

  @OneToMany(() => Session, (session) => session.user)
  sessions: Session[];

  @OneToMany(() => Account, (account) => account.user)
  accounts: Account[];

  @Column({ type: 'timestamptz', nullable: true })
  @IsOptional()
  banExpires?: Date;

  @Column({ type: 'boolean', nullable: true })
  @IsBoolean()
  @IsOptional()
  banned?: boolean;

  @Column({ type: 'text', nullable: true })
  @IsString()
  @IsOptional()
  banReason?: string;

  @Column({ type: 'boolean', nullable: true, default: false })
  @IsBoolean()
  @IsOptional()
  twoFactorEnabled?: boolean;
}
