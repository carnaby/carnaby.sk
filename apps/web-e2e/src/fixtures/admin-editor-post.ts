import { eq } from 'drizzle-orm';

import { createDb, posts } from '@carnaby/db';
import { slugify } from '@carnaby/shared';

export const E2E_EDITOR_POST_TITLE = 'E2E editor — nový koncept SK';
// Computed with the exact same `slugify` the editor itself auto-generates the slug from
// (`components/admin/editor-state.ts`'s `setTranslationField`) rather than hand-typed, so this
// always matches whatever slug `admin-post-editor.spec.ts` actually ends up creating.
export const E2E_EDITOR_POST_SLUG = slugify(E2E_EDITOR_POST_TITLE);

const DATABASE_URL = process.env['DATABASE_URL'] ?? 'postgres://carnaby:carnaby@localhost:5432/carnaby';

/**
 * `admin-post-editor.spec.ts` creates this post fresh through the real `/admin/posts/new` UI on
 * every run (unlike `admin-post.ts`'s upserted fixture row, there's nothing to seed -- the test
 * itself is the thing exercising creation). This just clears out any leftover row from a previous
 * run first, so repeated runs don't collide on the slug's unique constraint.
 */
export async function resetEditorFixturePost(): Promise<void> {
  const { db, pool } = createDb(DATABASE_URL);
  try {
    await db.delete(posts).where(eq(posts.slug, E2E_EDITOR_POST_SLUG));
  } finally {
    await pool.end();
  }
}
