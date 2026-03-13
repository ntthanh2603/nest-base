import { Role } from '@/commons/enums/app.enum';
import { betterAuth } from 'better-auth';
import {
  admin,
  openAPI,
  jwt,
  bearer,
  twoFactor,
  multiSession,
} from 'better-auth/plugins';
import { v7 as uuidv7 } from 'uuid';
import type { ConfigService } from '@nestjs/config';
import type { Pool } from 'pg';
import type { MailService } from '@/services/mail/mail.service';
import type { RedisService } from '@/services/redis/redis.service';

export type Auth = ReturnType<typeof getAuth>;

export const getAuth = (
  database: Pool,
  configService: ConfigService,
  mailService: MailService,
  redisService: RedisService,
) =>
  betterAuth({
    database,
    baseURL:
      configService.get<string>('BETTER_AUTH_BASE_URL')?.trim() ||
      'http://localhost:3000/api/auth',
    secret: configService.get<string>('BETTER_AUTH_SECRET'),
    logger: { disabled: false, level: 'debug' },
    secondaryStorage: redisService
      ? {
          get: async (key: string) => redisService.get(key),
          set: async (key: string, value: string, ttl?: number) => {
            if (ttl) {
              await redisService.setex(key, ttl, value);
            } else {
              await redisService.set(key, value);
            }
          },
          delete: async (key: string) => {
            await redisService.del(key);
          },
        }
      : undefined,
    plugins: [
      admin({ defaultRole: Role.USER, adminRoles: [Role.ADMIN] }),
      openAPI({ path: '/docs' }),
      jwt({
        jwks: {},
      }),
      bearer(),
      multiSession(),
      twoFactor({
        issuer: configService.get<string>('APP_NAME', 'Nest base'),
        skipVerificationOnEnable: false,
        otpOptions: {
          digits: 6,
          period: 300,
          sendOTP: async ({
            user,
            otp,
          }: {
            user: { email: string };
            otp: string;
          }) => {
            await mailService.sendOtp(user.email, otp);
          },
        },
      }),
    ],
    socialProviders: {
      google: {
        clientId: configService.get<string>('GOOGLE_CLIENT_ID', ''),
        clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET', ''),
        prompt: 'select_account',
      },
    },
    trustedOrigins: [
      configService.get<string>('FRONTEND_URL', 'http://localhost:5173'),
    ],
    advanced: {
      useSecureCookies: false,
      disableCSRFCheck: true,
      database: {
        generateId: () => uuidv7(),
      },
      onAPIError: {
        errorURL: configService.get<string>(
          'FRONTEND_URL',
          'http://localhost:5173',
        ),
      },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      storage: 'secondary-storage',
      modelName: 'authRateLimit',
    },
    emailAndPassword: {
      enabled: true,
      autoSignIn: false,
      sendPasswordReset: async ({ user, url }: { user: { email: string }; url: string }) => {
        await mailService.sendPasswordReset(user.email, url);
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: false,
      requireEmailVerification: true,
      sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string }) => {
        await mailService.sendVerificationEmail(user.email, url);
      },
    },
    session: {
      cookieCache: { enabled: true, maxAge: 300 },
      expiresIn: 2592000, // 30 days
      updateAge: 86400,
      freshAge: 600,
      modelName: 'session',
    },
    user: {
      modelName: 'user',
      additionalFields: {
        role: { type: 'string', defaultValue: Role.USER },
        twoFactorEnabled: { type: 'boolean', defaultValue: false },
      },
    },
    account: {
      modelName: 'account',
      accountLinking: {
        enabled: true,
        allowDifferentEmails: false,
      },
    },
    verification: {
      modelName: 'verification',
    },
  });
