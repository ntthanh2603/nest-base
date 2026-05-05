import { Injectable, OnModuleInit } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

export type IsolationLevel = 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';

@Injectable()
export class DatabaseService implements OnModuleInit {
  constructor(private dataSource: DataSource) {}

  onModuleInit() {
    this.overrideDefaultTransactionIsolation();
  }

  /**
   * Monkey patch the DataSource.transaction method to use 'SERIALIZABLE'
   * as the default isolation level instead of PostgreSQL's default (READ COMMITTED).
   */
  private overrideDefaultTransactionIsolation() {
    const originalTransaction = this.dataSource.transaction.bind(this.dataSource) as {
      <T>(runInTransaction: (entityManager: EntityManager) => Promise<T>): Promise<T>;
      <T>(isolationLevel: IsolationLevel, runInTransaction: (entityManager: EntityManager) => Promise<T>): Promise<T>;
    };

    this.dataSource.transaction = <T>(
      isolationOrRun: IsolationLevel | ((entityManager: EntityManager) => Promise<T>),
      runInTransaction?: (entityManager: EntityManager) => Promise<T>,
    ): Promise<T> => {
      if (typeof isolationOrRun === 'function') {
        return originalTransaction('SERIALIZABLE', isolationOrRun);
      }
      
      if (runInTransaction) {
        return originalTransaction(isolationOrRun, runInTransaction);
      }

      throw new Error('Invalid arguments passed to transaction');
    };
  }
}
