import { createDb } from '@carnaby/db';
import { Global, Module } from '@nestjs/common';

export const DB = Symbol('DB');
export const DB_POOL = Symbol('DB_POOL');

const conn = createDb(process.env.DATABASE_URL ?? 'postgres://carnaby:carnaby@localhost:5432/carnaby');

@Global()
@Module({
  providers: [
    { provide: DB, useValue: conn.db },
    { provide: DB_POOL, useValue: conn.pool },
  ],
  exports: [DB, DB_POOL],
})
export class DbModule {}
