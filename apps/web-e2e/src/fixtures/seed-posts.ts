import { eq } from 'drizzle-orm';

import { categories, createDb, postCategories, posts, postTranslations } from '@carnaby/db';

/** Slug of the fixture post the e2e suite asserts on — kept stable (not run-unique) so re-running
 * the suite locally doesn't accumulate rows: `seedPosts` upserts it by slug each time. */
export const E2E_FEATURED_SLUG = 'e2e-unique';

const DATABASE_URL = process.env['DATABASE_URL'] ?? 'postgres://carnaby:carnaby@localhost:5432/carnaby';

/**
 * Inserts (or updates in place) a single featured, published post (category `devlog`, sk + en
 * translations) into the dev Postgres database so `home.spec.ts`'s featured grid and
 * `post.spec.ts` have something to render. Invoked from `playwright.config.mts`'s `globalSetup`
 * -- runs once before the suite, against the same dev DB the `webServer`-started api/web
 * processes already point at (`DATABASE_URL` in root `.env`).
 */
export async function seedPosts(): Promise<void> {
  const { db, pool } = createDb(DATABASE_URL);
  try {
    const [category] = await db.select().from(categories).where(eq(categories.slug, 'devlog')).limit(1);
    if (!category) {
      throw new Error(
        "seed-posts: 'devlog' category not found. Seed the dev database first (`pnpm --filter @carnaby/db exec tsx src/seed.ts`).",
      );
    }

    // Upsert by slug rather than delete-then-insert: recreating the row would hand it a new
    // `posts.id` every run (Postgres `serial`), and the post detail page's `bySlug` read is
    // cached for 5 minutes (`apps/web/lib/trpc-server.ts`'s `tagsFor`) *on disk*
    // (`.next/cache/fetch-cache`), surviving even a dev-server restart -- so a second suite run
    // within that window could render a cached page carrying the *previous* run's now-stale id,
    // and `ViewTracker`'s `posts.incrementViews.mutate({ id })` would silently match zero rows.
    // Keeping the same id across runs sidesteps that entirely.
    const [existing] = await db.select().from(posts).where(eq(posts.slug, E2E_FEATURED_SLUG)).limit(1);
    const [post] = existing
      ? await db.update(posts).set({ status: 'published', isFeatured: true, publishedAt: new Date() })
          .where(eq(posts.id, existing.id)).returning()
      : await db.insert(posts).values({ slug: E2E_FEATURED_SLUG, status: 'published', isFeatured: true, publishedAt: new Date() })
          .returning();
    if (!post) throw new Error('seed-posts: upsert into posts returned no row');

    // Translations/categories are still cleared and reinserted -- cheap, and keeps their content
    // in sync with this file if it's ever edited, without needing per-language upsert logic.
    await db.delete(postTranslations).where(eq(postTranslations.postId, post.id));
    await db.delete(postCategories).where(eq(postCategories.postId, post.id));

    await db.insert(postTranslations).values([
      { postId: post.id, language: 'sk', title: 'E2E testovací príspevok', excerpt: 'Excerpt pre e2e test.', content: 'Obsah e2e testovacieho príspevku.' },
      { postId: post.id, language: 'en', title: 'E2E test post', excerpt: 'Excerpt for the e2e test.', content: 'Body of the e2e test post.' },
    ]);
    await db.insert(postCategories).values({ postId: post.id, categoryId: category.id });
  } finally {
    await pool.end();
  }
}
