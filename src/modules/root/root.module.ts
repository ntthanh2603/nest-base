import { Module } from '@nestjs/common';
import { RootService } from './root.service';
import { RootController } from './root.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [RootController],
  providers: [RootService],
})
export class RootModule {}
