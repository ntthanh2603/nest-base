import { BaseEntity } from '@/commons/entities/base.entity';
import { Column, Entity } from 'typeorm';

export enum MediaStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Entity('medias')
export class Media extends BaseEntity {
  @Column()
  filename: string;

  @Column()
  originalName: string;

  @Column()
  mimeType: string;

  @Column({ type: 'bigint' })
  size: number;

  @Column({ nullable: true })
  s3Key: string;

  @Column({ nullable: true })
  url: string;

  @Column({
    type: 'enum',
    enum: MediaStatus,
    default: MediaStatus.PENDING,
  })
  status: MediaStatus;
}
