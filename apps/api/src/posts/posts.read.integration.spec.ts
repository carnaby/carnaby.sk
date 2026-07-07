import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDb } from '@carnaby/db';
import { categories, postCategories, posts, postTranslations } from '@carnaby/db';
import { appRouter } from '../trpc/app-router';

const url = process.env['TEST_DATABASE_URL'];
const d = url ? describe : describe.skip;

d('posts read', () => {
  const { db, pool } = createDb(url!);
  const caller = appRouter.createCaller({ db, user: null });

  // Isolation note: this test DB is shared with @carnaby/db's schema.integration.spec (and
  // may run concurrently under `nx run-many` parallelism). We deliberately do NOT delete
  // existing rows (the brief's snippet does `db.delete(posts)`/`db.delete(categories)`) —
  // instead every fixture uses a run-unique slug, and assertions scope to those fixtures
  // (e.g. filtering `posts.list` by this run's own category slug) so concurrent runs/specs
  // can't collide or clobber each other's rows. The suffix combines a timestamp with a random
  // component (not just `Date.now()`) so two processes racing in the same millisecond — e.g.
  // two overlapping CI jobs — can't collide on the same slug and hit a unique-constraint error.
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const categorySlug = `devlog-${runId}`;
  const publishedSlug = `hello-${runId}`;
  const draftSlug = `wip-${runId}`;
  let publishedId = 0;
  let draftId = 0;

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: __dirname + '/../../../../packages/db/migrations' });
    const [cat] = await db.insert(categories).values({ slug: categorySlug, name: 'DevLog' }).returning();
    const [pub] = await db.insert(posts).values({ slug: publishedSlug, status: 'published', publishedAt: new Date(), isFeatured: true }).returning();
    const [draft] = await db.insert(posts).values({ slug: draftSlug, status: 'draft' }).returning();
    publishedId = pub!.id;
    draftId = draft!.id;
    await db.insert(postTranslations).values([
      { postId: pub!.id, language: 'en', title: 'Hello', content: 'EN body' },
      { postId: draft!.id, language: 'sk', title: 'WIP', content: 'x' },
    ]);
    // Both posts share the same run-scoped category, so the "lists only published" assertion
    // below is actually exercising status filtering — not merely category filtering (if it
    // were the latter alone, a regression that dropped the router's hardcoded
    // `statuses: ['published']` would go undetected since the draft would still be excluded
    // by category alone... except it isn't, because it's linked to the same category here).
    await db.insert(postCategories).values([
      { postId: pub!.id, categoryId: cat!.id },
      { postId: draft!.id, categoryId: cat!.id },
    ]);
  });
  afterAll(async () => { await pool.end(); });

  it('lists only published, falls back sk→en', async () => {
    const r = await caller.posts.list({ category: categorySlug });
    expect(r.total).toBe(1);
    expect(r.items[0]!.slug).toBe(publishedSlug);
    expect(r.items[0]!.language).toBe('en'); // requested sk, only en exists
    expect(r.items[0]!.categories[0]!.slug).toBe(categorySlug);
  });

  it('list() with no input at all applies defaults', async () => {
    // Exercises the outer `.default(...)` path (input fully `undefined`, not just `{}`) —
    // no count/order assertions here since the shared DB may hold unrelated concurrent rows.
    const r = await caller.posts.list();
    expect(r.page).toBe(1);
    expect(r.pageCount).toBeGreaterThanOrEqual(1);
  });

  it('bySlug returns content and availableLanguages, 404s drafts', async () => {
    const post = await caller.posts.bySlug({ slug: publishedSlug });
    expect(post.content).toBe('EN body');
    expect(post.availableLanguages).toEqual(['en']);
    await expect(caller.posts.bySlug({ slug: draftSlug })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('incrementViews increments a published post but not a draft', async () => {
    const before = await caller.posts.bySlug({ slug: publishedSlug });
    await caller.posts.incrementViews({ id: publishedId });
    const after = await caller.posts.bySlug({ slug: publishedSlug });
    expect(after.viewCount).toBe(before.viewCount + 1);

    const [draftBefore] = await db.select({ viewCount: posts.viewCount }).from(posts).where(eq(posts.id, draftId));
    await caller.posts.incrementViews({ id: draftId });
    const [draftAfter] = await db.select({ viewCount: posts.viewCount }).from(posts).where(eq(posts.id, draftId));
    expect(draftAfter!.viewCount).toBe(draftBefore!.viewCount);
  });
});
