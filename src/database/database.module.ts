import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseService } from './database.service';
import { dataSourceOptions, databaseConnectionConfig } from './database.config';

import { Pool } from 'pg';

@Global()
@Module({
  imports: [TypeOrmModule.forRoot(dataSourceOptions)],
  providers: [
    DatabaseService,
    {
      provide: 'PG_POOL',
      useFactory: (): Pool => {
        return new Pool({
          host: databaseConnectionConfig.host,
          port: databaseConnectionConfig.port,
          user: databaseConnectionConfig.username,
          password: databaseConnectionConfig.password,
          database: databaseConnectionConfig.database,
          ssl: databaseConnectionConfig.ssl,
        });
      },
    },
  ],
  exports: [DatabaseService, 'PG_POOL'],
})
export class DatabaseModule {}
