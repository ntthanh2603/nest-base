import { Role } from '@/commons/enums/app.enum';
import { betterAuth } from 'better-auth';
import {
  admin,
  jwt,
  bearer,
  twoFactor,
  multiSession,
  emailOTP,
  openAPI,
  phoneNumber,
} from 'better-auth/plugins';
import { v7 as uuidv7 } from 'uuid';
import type { ConfigService } from '@nestjs/config';
import type { Pool } from 'pg';
import type { MailService } from '@/services/mail/mail.service';
import type { RedisService } from '@/services/redis/redis.service';
import type { KafkaService } from '@/services/kafka/kafka.service';
import { KafkaTopic } from '@/services/kafka/kafka.enum';
import type { MailEventPayload } from '@/services/mail/mail.interface';

export type Auth = ReturnType<typeof getAuth>;

export const getAuth = (
  database: Pool,
  configService: ConfigService,
  mailService: MailService,
  redisService: RedisService,
  kafkaService: KafkaService,
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
      jwt(),
      bearer(),
      multiSession(),
      twoFactor({
        issuer: configService.get<string>('APP_NAME', 'Nest Base'),
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
            const payload: MailEventPayload = {
              pattern: 'send-otp',
              data: { email: user.email, otp },
              metadata: {
                source: 'better-auth.email-otp',
                timestamp: Date.now(),
              },
            };
            await kafkaService.produce(KafkaTopic.AUTH_MAIL, [payload]);
          },
        },
      }),
      emailOTP({
        async sendVerificationOTP({ email, otp }) {
          const payload: MailEventPayload = {
            pattern: 'send-otp',
            data: { email, otp },
            metadata: {
              source: 'better-auth.verification-otp',
              timestamp: Date.now(),
            },
          };
          await kafkaService.produce(KafkaTopic.AUTH_MAIL, [payload]);
        },
        sendVerificationOnSignUp: true,
        overrideDefaultEmailVerification: true,
        expiresIn: 300,
      }),
      phoneNumber(),
      openAPI({ path: '/docs' }),
    ],
    socialProviders: {
      google: {
        clientId: configService.get<string>('GOOGLE_CLIENT_ID', ''),
        clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET', ''),
        prompt: 'select_account',
      },
      apple: {
        clientId: configService.get<string>('APPLE_CLIENT_ID', ''),
        clientSecret: configService.get<string>('APPLE_CLIENT_SECRET', ''),
        teamId: configService.get<string>('APPLE_TEAM_ID', ''),
        keyId: configService.get<string>('APPLE_KEY_ID', ''),
        privateKey: configService.get<string>('APPLE_PRIVATE_KEY', ''),
      },
    },
    trustedOrigins: [
      configService.get<string>('FRONTEND_URL', 'http://localhost:5173'),
      'http://localhost:3000',
    ],
    advanced: {
      useSecureCookies: configService.get<string>('NODE_ENV') === 'production',
      disableCSRFCheck: configService.get<string>('NODE_ENV') !== 'production',
      database: {
        generateId: () => uuidv7(),
      },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      storage: 'secondary-storage',
      modelName: 'authRateLimit',
    },
    hooks: {
      before: async (context) => {
        if (!context.request) return { context };

        // Lấy pathname từ URL của yêu cầu
        const url = new URL(context.request.url);

        // Kiểm tra nếu là endpoint đăng ký email
        if (url.pathname.endsWith('/sign-up/email')) {
          const body = context.body as Record<string, unknown> | undefined;
          const email = body?.email;

          if (typeof email === 'string') {
            // Check if user exists but is NOT verified
            const userResult = await database.query(
              'SELECT id, "emailVerified" FROM "user" WHERE LOWER(email) = $1',
              [email.toLowerCase()],
            );
            const user = userResult.rows[0] as
              | { id: string; emailVerified: boolean }
              | undefined;

            if (user && !user.emailVerified) {
              // Delete the unverified user to allow a fresh sign-up
              await database.query('DELETE FROM "user" WHERE id = $1', [
                user.id,
              ]);
            }
          }
        }
        return { context };
      },
    },
    emailAndPassword: {
      enabled: true,
      autoSignIn: false,
      requireEmailVerification: true,
      sendResetPassword: async ({
        user,
        url,
      }: {
        user: { email: string };
        url: string;
      }) => {
        const payload: MailEventPayload = {
          pattern: 'send-password-reset',
          data: { email: user.email, url },
          metadata: {
            source: 'better-auth.password-reset',
            timestamp: Date.now(),
          },
        };
        await kafkaService.produce(KafkaTopic.AUTH_MAIL, [payload]);
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
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
        phoneNumber: { type: 'string' },
        mediaId: { type: 'string' },
        language: { type: 'string', defaultValue: 'en' },
        banned: { type: 'boolean', defaultValue: false },
        banReason: { type: 'string' },
        banExpires: { type: 'date' },
      },
    },
    twoFactor: {
      modelName: 'twoFactor',
    },
    jwks: {
      modelName: 'jwks',
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
