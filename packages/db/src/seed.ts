import { CATEGORIES, DEFAULT_LANGUAGE } from '@carnaby/shared';
import { createDb } from './client';
import { categories } from './schema';

export async function seed(databaseUrl: string) {
  const { db, pool } = createDb(databaseUrl);
  const values = Object.values(CATEGORIES).map((c, i) => ({
    slug: c.slug, name: c.name[DEFAULT_LANGUAGE], description: c.description[DEFAULT_LANGUAGE], sortOrder: i,
  }));
  for (const v of values) {
    await db.insert(categories).values(v)
      .onConflictDoUpdate({ target: categories.slug, set: { name: v.name, description: v.description, sortOrder: v.sortOrder } });
  }
  await pool.end();
}

if (process.argv[1]?.endsWith('seed.ts')) {
  seed(process.env['DATABASE_URL'] ?? 'postgres://carnaby:carnaby@localhost:5432/carnaby')
    .then(() => console.log('seeded'))
    .catch((e) => { console.error(e); process.exit(1); });
}
