import { BaseEntity } from '@/commons/entities/base.entity';
import { Column, Entity, ManyToOne } from 'typeorm';
import { User } from './user.entity';

@Entity('twoFactor')
export class TwoFactor extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column('text')
  secret: string;

  @Column('text', { nullable: true })
  backupCodes?: string;

  @Column('text', { nullable: true })
  trustDeviceCookieName?: string;

  @Column('boolean', { nullable: true, default: false })
  trustDevice?: boolean;

  @Column('text', { nullable: true, default: 'totp' })
  type?: string;
}
