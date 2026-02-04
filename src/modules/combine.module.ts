import { Module } from '@nestjs/common';
import { AbcModule } from './abc/abc.module';

@Module({
  imports: [AbcModule],
})
export class CombineModule {}
