import { BaseEntity } from '@/commons/entities/base.entity';
import { Role } from '@/commons/enums/app.enum';
import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, OneToMany } from 'typeorm';
import { Account } from './account.entity';
import { Session } from './session.entity';

@Entity('user')
export class User extends BaseEntity {
  @ApiProperty()
  @Column('text')
  name: string;

  @Column('text', { unique: true })
  email: string;

  @Column('boolean')
  emailVerified: boolean;

  @Column('text', { nullable: true })
  image?: string;

  @ApiProperty({ enum: Role })
  @Column({ type: 'enum', enum: Role, default: Role.USER })
  role: Role;

  @Column({ type: 'text', default: 'en' })
  language: string;

  @OneToMany(() => Session, (session) => session.user)
  sessions: Session[];

  @OneToMany(() => Account, (account) => account.user)
  accounts: Account[];

  @Column('date', { nullable: true })
  banExpires: Date;

  @Column('boolean', { nullable: true })
  banned?: boolean;

  @Column('text', { nullable: true })
  banReason?: string;

  @Column('boolean', { nullable: true, default: false })
  twoFactorEnabled?: boolean;
}
