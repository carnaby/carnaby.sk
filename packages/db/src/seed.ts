import { CATEGORIES, DEFAULT_LANGUAGE } from '@carnaby/shared';
import { createDb, type Db, type Tx } from './client';
import { categories } from './schema';

/**
 * Upserts the canonical devlog/dodo/carnaby categories. Takes `Db | Tx` so it can run standalone
 * (the `seed()` wrapper below, used by `nx run @carnaby/db:seed` and any other caller with a
 * plain connection) or inside an existing transaction (e.g. `migrate-legacy`'s `migrate.ts` calls
 * `seedCategories(tx)` as one step of its single wrapping transaction, instead of opening a
 * second unrelated connection/transaction the way it used to via `seed(url)`).
 */
export async function seedCategories(db: Db | Tx): Promise<void> {
  const values = Object.values(CATEGORIES).map((c, i) => ({
    slug: c.slug, name: c.name[DEFAULT_LANGUAGE], description: c.description[DEFAULT_LANGUAGE], sortOrder: i,
  }));
  for (const v of values) {
    await db.insert(categories).values(v)
      .onConflictDoUpdate({ target: categories.slug, set: { name: v.name, description: v.description, sortOrder: v.sortOrder } });
  }
}

/** Thin CLI-facing wrapper: opens its own pool, runs `seedCategories`, closes the pool. */
export async function seed(databaseUrl: string): Promise<void> {
  const { db, pool } = createDb(databaseUrl);
  await seedCategories(db);
  await pool.end();
}

if (process.argv[1]?.endsWith('seed.ts')) {
  seed(process.env['DATABASE_URL'] ?? 'postgres://carnaby:carnaby@localhost:5432/carnaby')
    .then(() => console.log('seeded'))
    .catch((e) => { console.error(e); process.exit(1); });
}
