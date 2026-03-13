import { BaseEntity } from '@/commons/entities/base.entity';
import { Column, Entity } from 'typeorm';

@Entity('verification')
export class Verification extends BaseEntity {
  @Column('text')
  identifier: string;

  @Column('text')
  value: string;

  @Column('timestamp')
  expiresAt: Date;
}
