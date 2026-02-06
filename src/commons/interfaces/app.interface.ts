import type { Request } from 'express';
import type { DataSource } from 'typeorm';
import type { Role } from '../enums/app.enum';

export interface UserContextPayload {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResultHandler {
  dataSource: DataSource;
  result: string;
}

export interface RequestWithMetadata extends Request {
  session: {
    token: string;
    expiresAt: Date;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    ipAddress?: string | null | undefined;
    userAgent?: string | null | undefined;
  };
  user: {
    id: string;
    email: string;
    emailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
    name: string;
    image?: string | null | undefined;
    role: Role;
  };
}
