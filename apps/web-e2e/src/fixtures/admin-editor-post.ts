import { eq } from 'drizzle-orm';

import { categories, createDb, postCategories, postTranslations, posts } from '@carnaby/db';
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

/** Stable slug/id for the *edit* round-trip fixture (`/admin/posts/<id>/edit`) -- a separate row
 * from the "new post" fixture above, upserted (not run-unique) the same way `admin-post.ts`'s
 * `seedAdminFixturePost` is, since `admin-post-editor.spec.ts`'s round-trip test only reads this
 * one, never saves over it. */
export const E2E_EDITOR_EDIT_POST_SLUG = 'e2e-editor-edit-fixture';
export const E2E_EDITOR_EDIT_POST_TITLE = 'E2E editor — existujúci koncept na úpravu';
export const E2E_EDITOR_EDIT_POST_CONTENT = 'Obsah existujúceho konceptu určeného na úpravu.';
// Matches `packages/shared/src/categories.ts`'s `devlog` category, already seeded into the dev db
// by `packages/db/src/seed.ts` -- same category `seed-posts.ts` relies on for its own fixture.
const E2E_EDITOR_EDIT_POST_CATEGORY_SLUG = 'devlog';
export const E2E_EDITOR_EDIT_POST_CATEGORY_NAME = 'DevLog';

/**
 * Seeds (or reuses) a draft post with a SK translation and one category assigned, for
 * `admin-post-editor.spec.ts`'s read-only "editing an existing post round-trips its data into the
 * form" test to load via `/admin/posts/<id>/edit`. Returns the row's real id, since the edit
 * route is keyed by id rather than slug.
 */
export async function seedEditorEditFixturePost(): Promise<{ id: number }> {
  const { db, pool } = createDb(DATABASE_URL);
  try {
    const [category] = await db.select().from(categories).where(eq(categories.slug, E2E_EDITOR_EDIT_POST_CATEGORY_SLUG)).limit(1);
    if (!category) {
      throw new Error(
        `seedEditorEditFixturePost: '${E2E_EDITOR_EDIT_POST_CATEGORY_SLUG}' category not found. Seed the dev database first (\`pnpm --filter @carnaby/db exec tsx src/seed.ts\`).`,
      );
    }

    const [existing] = await db.select().from(posts).where(eq(posts.slug, E2E_EDITOR_EDIT_POST_SLUG)).limit(1);
    const [post] = existing
      ? [existing]
      : await db.insert(posts).values({ slug: E2E_EDITOR_EDIT_POST_SLUG, status: 'draft', isFeatured: false }).returning();
    if (!post) throw new Error('seedEditorEditFixturePost: upsert into posts returned no row');

    // Translation and category are cleared and reinserted every run -- cheap, and keeps them in
    // sync with this file if the title/content/category are ever edited (same convention as
    // `seed-posts.ts`/`admin-post.ts`).
    await db.delete(postTranslations).where(eq(postTranslations.postId, post.id));
    await db.insert(postTranslations).values({
      postId: post.id,
      language: 'sk',
      title: E2E_EDITOR_EDIT_POST_TITLE,
      content: E2E_EDITOR_EDIT_POST_CONTENT,
    });

    await db.delete(postCategories).where(eq(postCategories.postId, post.id));
    await db.insert(postCategories).values({ postId: post.id, categoryId: category.id });

    return { id: post.id };
  } finally {
    await pool.end();
  }
}
