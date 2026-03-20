import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Media } from './entities/media.entity';
import { KafkaModule } from '../kafka/kafka.module';
import { StorageService } from './storage.service';

@Module({
  imports: [TypeOrmModule.forFeature([Media]), KafkaModule],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
