import { eq } from 'drizzle-orm';

import { createDb, postTranslations, posts } from '@carnaby/db';

/** Stable slug (not run-unique), upserted each run -- same convention as `seed-posts.ts`'s
 * `E2E_FEATURED_SLUG`. `admin-posts.spec.ts` deletes this row through the real UI, which removes
 * it from the DB entirely; the next run's "does it exist" check below then just re-inserts it,
 * so no explicit cleanup/teardown step is needed either way. */
export const E2E_ADMIN_POST_SLUG = 'e2e-admin-delete-me';
export const E2E_ADMIN_POST_TITLE = 'E2E administrácia — zmazať ma';

const DATABASE_URL = process.env['DATABASE_URL'] ?? 'postgres://carnaby:carnaby@localhost:5432/carnaby';

/** Seeds a single draft, uncategorized post for `admin-posts.spec.ts` to find in the admin table
 * and delete via the real delete-confirm-dialog flow. */
export async function seedAdminFixturePost(): Promise<void> {
  const { db, pool } = createDb(DATABASE_URL);
  try {
    const [existing] = await db.select().from(posts).where(eq(posts.slug, E2E_ADMIN_POST_SLUG)).limit(1);
    const [post] = existing
      ? [existing]
      : await db.insert(posts).values({ slug: E2E_ADMIN_POST_SLUG, status: 'draft', isFeatured: false }).returning();
    if (!post) throw new Error('seedAdminFixturePost: upsert into posts returned no row');

    // Translation is cleared and reinserted every run -- cheap, and keeps it in sync with this
    // file if the title text is ever edited (same rationale as `seed-posts.ts`).
    await db.delete(postTranslations).where(eq(postTranslations.postId, post.id));
    await db.insert(postTranslations).values({
      postId: post.id,
      language: 'sk',
      title: E2E_ADMIN_POST_TITLE,
      content: 'Obsah e2e testovacieho príspevku určeného na zmazanie.',
    });
  } finally {
    await pool.end();
  }
}
