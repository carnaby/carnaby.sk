import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export function createDb(connectionString: string) {
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });
  return { db, pool };
}
export type Db = ReturnType<typeof createDb>['db'];
/** The `tx` handle passed into `db.transaction(async (tx) => ...)`. Extracted structurally from
 * `Db['transaction']` (rather than importing drizzle's internal `PgTransaction` type by name) so
 * it always matches whatever `Db` actually is. Needed because `Db` itself isn't assignable from a
 * `tx` (drizzle's `drizzle()` factory return type adds a `$client` field that transactions don't
 * have) -- functions that must run either standalone or inside a caller's transaction (e.g.
 * `seedCategories`) take `Db | Tx`. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
