import { Pool } from 'pg';
const {
  POSTGRES_HOST,
  POSTGRES_USERNAME,
  POSTGRES_PASSWORD,
  POSTGRES_PORT,
  POSTGRES_DB,
  POSTGRES_SSL,
} = process.env;

export const databaseConnectionConfig = {
  host: POSTGRES_HOST || 'localhost',
  user: POSTGRES_USERNAME || 'postgres',
  username: POSTGRES_USERNAME || 'postgres',
  password: POSTGRES_PASSWORD || 'postgres',
  port: parseInt(POSTGRES_PORT || '5432', 10),
  database: POSTGRES_DB || 'anex',
  ssl: Boolean(POSTGRES_SSL === 'true'),
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
export const database: Pool = new Pool(databaseConnectionConfig);
