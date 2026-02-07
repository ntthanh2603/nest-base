import { Module } from '@nestjs/common';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from './auth/auth';
import { UsersModule } from './users/users.module';
import { RootModule } from './root/root.module';

@Module({
  imports: [
    AuthModule.forRoot({
      auth,
    }),
    UsersModule,
    RootModule,
  ],
})
export class CombineModule {}
