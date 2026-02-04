import { Module } from '@nestjs/common';
import { AbcService } from './abc.service';
import { AbcController } from './abc.controller';

@Module({
  controllers: [AbcController],
  providers: [AbcService],
})
export class AbcModule {}
