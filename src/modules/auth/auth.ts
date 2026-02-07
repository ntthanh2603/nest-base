import { AUTH_IGNORE_ROUTERS } from '@/commons/constants/app.constants';
import { Role } from '@/commons/enums/app.enum';
import { database } from '@/database/database-config';
import type { Auth } from 'better-auth';
import { betterAuth } from 'better-auth';
import { admin, openAPI } from 'better-auth/plugins';
import { randomUUID } from 'crypto';
import 'dotenv/config';

export const auth: Auth = betterAuth({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  database: database,
  baseURL: process.env.BETTER_AUTH_BASE_URL || 'http://localhost:3000/api/auth',
  plugins: [
    admin({
      defaultRole: Role.USER,
      adminRoles: [Role.ADMIN],
    }),
    openAPI({
      path: '/docs',
    }),
  ],
  trustedOrigins: ['*'],
  advanced: {
    database: {
      generateId: () => randomUUID(),
    },
    cookies: {
      session_token: {
        name: 'session',
        attributes: {
          httpOnly: true,
          // secure: true,
          // sameSite: 'strict',
        },
      },
    },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 10,
    storage: 'memory',
    modelName: 'auth-rate-limit',
  },
  emailAndPassword: {
    enabled: true,
  },
  session: {
    freshAge: 10,
    modelName: 'sessions',
  },
  disabledPaths: AUTH_IGNORE_ROUTERS,
  user: {
    modelName: 'users',
    additionalFields: {
      role: {
        type: 'string',
        enum: Role,
        default: Role.USER,
      },
    },
  },
  account: {
    modelName: 'accounts',
  },
  verification: {
    modelName: 'verifications',
  },
});
