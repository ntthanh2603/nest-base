import { Module } from '@nestjs/common';
import { RootService } from './root.service';
import { RootController } from './root.controller';

@Module({
  imports: [],
  controllers: [RootController],
  providers: [RootService],
})
export class RootModule {}
