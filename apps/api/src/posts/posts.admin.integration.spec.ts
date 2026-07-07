import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { randomBytes } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createDb, categories, postTranslations, user } from '@carnaby/db';
import { appRouter } from '../trpc/app-router';
import { eq } from 'drizzle-orm';

const url = process.env['TEST_DATABASE_URL'];
const d = url ? describe : describe.skip;

d('posts admin', () => {
  const { db, pool } = createDb(url!);
  // Isolation note: mirrors posts.read.integration.spec's rationale — this test DB is shared
  // (other spec files, possible concurrent `nx run-many` runs) and never cleaned between runs.
  // The brief's snippet hardcodes email 'a@a.sk' and slug 'adm-' + Date.now(); email is unique
  // on `user`, and if a previous run's row with that email still exists (different random id),
  // `onConflictDoNothing()` would silently keep the OLD id — then this run's `adminUser.id`
  // (used as `posts.authorId`, FK'd to `user.id`) would reference a row that was never inserted,
  // failing the post insert with a foreign-key violation. A run-unique email closes that gap.
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const adminUser = { id: randomBytes(16).toString('hex'), email: `admin-${runId}@a.sk`, name: 'A', image: null, role: 'admin' };
  const nonAdminUser = { id: randomBytes(16).toString('hex'), email: `user-${runId}@a.sk`, name: 'U', image: null, role: 'user' };
  const admin = appRouter.createCaller({ db, user: adminUser });
  const anon = appRouter.createCaller({ db, user: null });
  const nonAdmin = appRouter.createCaller({ db, user: nonAdminUser });
  const categorySlug = `adm-${runId}`;
  let catId = 0;

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: __dirname + '/../../../../packages/db/migrations' });
    await db.insert(user).values({ id: adminUser.id, email: adminUser.email, name: 'A' }).onConflictDoNothing();
    await db.insert(user).values({ id: nonAdminUser.id, email: nonAdminUser.email, name: 'U' }).onConflictDoNothing();
    const [c] = await db.insert(categories).values({ slug: categorySlug, name: 'Adm' }).returning();
    catId = c!.id;
  });
  afterAll(async () => { await pool.end(); });

  it('rejects non-admin', async () => {
    await expect(anon.posts.adminList({})).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects user role with FORBIDDEN', async () => {
    await expect(nonAdmin.posts.adminList({})).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('create → byId → update (drops EN) → adminList → remove', async () => {
    const { id } = await admin.posts.create({
      slug: `adm-post-${runId}`, status: 'draft', isFeatured: false, categoryIds: [catId],
      translations: { sk: { title: 'SK', content: 'sk body' }, en: { title: 'EN', content: 'en body' } },
    });
    const loaded = await admin.posts.byId({ id });
    expect(loaded.translations.en?.title).toBe('EN');
    expect(loaded.categoryIds).toEqual([catId]);

    await admin.posts.update({ id, slug: loaded.post.slug, status: 'published', isFeatured: true,
      categoryIds: [catId], translations: { sk: { title: 'SK2', content: 'sk body' } } });
    const after = await db.select().from(postTranslations).where(eq(postTranslations.postId, id));
    expect(after.map((t) => t.language)).toEqual(['sk']);

    // Scoped to this run's unique category (rather than the brief's unfiltered `adminList({})`)
    // so the assertion is robust against the shared, never-cleaned test DB accumulating more
    // than a page's worth of posts over time — see posts.read.integration.spec's isolation note.
    const list = await admin.posts.adminList({ category: categorySlug });
    const row = list.items.find((i) => i.id === id)!;
    expect(row.status).toBe('published');
    expect(row.hasSk).toBe(true);
    expect(row.hasEn).toBe(false);

    await admin.posts.remove({ id });
    await expect(admin.posts.byId({ id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
