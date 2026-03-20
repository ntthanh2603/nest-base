import { BaseEntity } from '@/commons/entities/base.entity';
import { Entity, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum MediaStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Entity('medias')
export class Media extends BaseEntity {
  @ApiProperty()
  @Column()
  filename: string;

  @ApiProperty()
  @Column()
  originalName: string;

  @ApiProperty()
  @Column()
  mimeType: string;

  @ApiProperty()
  @Column({ type: 'bigint' })
  size: number;

  @ApiProperty()
  @Column({ nullable: true })
  s3Key: string;

  @ApiProperty()
  @Column({ nullable: true })
  url: string;

  @Column({
    type: 'enum',
    enum: MediaStatus,
    default: MediaStatus.PENDING,
  })
  status: MediaStatus;
}
