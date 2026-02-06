import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConnectionConfig } from './database-config';
import { DatabaseService } from './database.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      entities: [__dirname + '/../**/**/*.entity{.ts,.js}'],
      ...databaseConnectionConfig,
      synchronize: process.env.NODE_ENV !== 'production',
    }),
  ],
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
