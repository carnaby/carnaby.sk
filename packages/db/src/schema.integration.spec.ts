import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createDb } from './client';
import { categories, posts, postTranslations } from './schema';

const url = process.env['TEST_DATABASE_URL'];
const d = url ? describe : describe.skip;

d('schema', () => {
  const { db, pool } = createDb(url!);
  beforeAll(async () => { await migrate(db, { migrationsFolder: __dirname + '/../migrations' }); });
  afterAll(async () => { await pool.end(); });

  it('enforces unique (postId, language)', async () => {
    const [cat] = await db.insert(categories).values({ slug: 't-' + Date.now(), name: 'T' }).returning();
    const [post] = await db.insert(posts).values({ slug: 'p-' + Date.now() }).returning();
    await db.insert(postTranslations).values({ postId: post!.id, language: 'sk', title: 'a', content: 'b' });
    await expect(
      db.insert(postTranslations).values({ postId: post!.id, language: 'sk', title: 'c', content: 'd' }),
    ).rejects.toThrow();
    expect(cat!.id).toBeGreaterThan(0);
  });
});
