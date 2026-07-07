import { eq } from 'drizzle-orm';

import { categories, createDb, postCategories, posts, postTranslations } from '@carnaby/db';

/** Slug of the fixture post the e2e suite asserts on — kept stable (not run-unique) so re-running
 * the suite locally doesn't accumulate rows: `seedPosts` deletes and recreates it each time. */
export const E2E_FEATURED_SLUG = 'e2e-unique';

const DATABASE_URL = process.env['DATABASE_URL'] ?? 'postgres://carnaby:carnaby@localhost:5432/carnaby';

/**
 * Inserts a single featured, published post (category `devlog`, sk + en translations) into the
 * dev Postgres database so `home.spec.ts`'s featured grid has something to render. Invoked from
 * `playwright.config.mts`'s `globalSetup` — runs once before the suite, against the same dev DB
 * the `webServer`-started api/web processes already point at (`DATABASE_URL` in root `.env`).
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

    // Delete-then-recreate rather than upsert: `post_translations`/`post_categories` cascade off
    // `posts.id` (see packages/db/src/schema/content.ts), so this also clears any stale
    // translation/category rows from a previous run without hand-rolling a composite upsert.
    await db.delete(posts).where(eq(posts.slug, E2E_FEATURED_SLUG));

    const [post] = await db
      .insert(posts)
      .values({ slug: E2E_FEATURED_SLUG, status: 'published', isFeatured: true, publishedAt: new Date() })
      .returning();
    if (!post) throw new Error('seed-posts: insert into posts returned no row');

    await db.insert(postTranslations).values([
      { postId: post.id, language: 'sk', title: 'E2E testovací príspevok', excerpt: 'Excerpt pre e2e test.', content: 'Obsah e2e testovacieho príspevku.' },
      { postId: post.id, language: 'en', title: 'E2E test post', excerpt: 'Excerpt for the e2e test.', content: 'Body of the e2e test post.' },
    ]);
    await db.insert(postCategories).values({ postId: post.id, categoryId: category.id });
  } finally {
    await pool.end();
  }
}
