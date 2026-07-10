import 'dotenv/config';
import { resolve } from 'node:path';
import { Client, type Pool } from 'pg';
import { createDb, seed, account as accountTable, categories as categoriesTable, postCategories, postTranslations, posts as postsTable, user as userTable } from '@carnaby/db';
import { buildTranslations, mapPost, mapUser } from './mapping';
import type { LegacyPost, LegacyTranslation, LegacyUser } from './mapping';
import { findMissingThumbnails, formatReport, reportHasFailures } from './report';
import type { CountRow, MigrationReport, SampleSlug } from './report';

type Db = ReturnType<typeof createDb>['db'];

const LEGACY_DATABASE_URL = process.env['LEGACY_DATABASE_URL'] ?? 'postgres://carnaby:carnaby@localhost:5432/carnaby_legacy';
const DATABASE_URL = process.env['DATABASE_URL'] ?? 'postgres://carnaby:carnaby@localhost:5432/carnaby';

/** Falls back to a lowercase, hyphenated slug for any legacy category that (in very old rows)
 * never got a `slug` backfilled -- see migration 004's `UPDATE categories SET slug = LOWER(name)`. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Wipes the v2 content + auth tables so the migration is idempotent (safe to re-run against the
 * same target db). This intentionally also destroys `session`/`account`/`user`/`verification` --
 * anyone logged in locally gets signed out, and any dev seed/e2e fixture data in these tables is
 * gone after a run. That's the accepted cost of a disposable local rehearsal db; see the task
 * report for the post-run reseed step.
 */
async function truncateTarget(pool: Pool): Promise<void> {
  await pool.query(
    'TRUNCATE post_categories, post_translations, posts, categories, "verification", "account", "session", "user" RESTART IDENTITY CASCADE',
  );
}

async function migrateCategories(
  legacy: Client,
  db: Db,
): Promise<{ categorySlugToNewId: Map<string, number>; categoryOldIdToSlug: Map<number, string>; oldCount: number }> {
  await seed(DATABASE_URL); // canonical devlog/dodo/carnaby rows

  const { rows: legacyCategories } = await legacy.query<{ id: number; name: string; slug: string | null; description: string | null }>(
    'SELECT id, name, slug, description FROM categories ORDER BY id',
  );

  const categoryOldIdToSlug = new Map<number, string>();
  for (const cat of legacyCategories) categoryOldIdToSlug.set(cat.id, cat.slug ?? slugify(cat.name));

  const seeded = await db.select().from(categoriesTable);
  const knownSlugs = new Set(seeded.map((c) => c.slug));
  let nextSortOrder = seeded.length;

  for (const cat of legacyCategories) {
    const slug = categoryOldIdToSlug.get(cat.id)!;
    if (knownSlugs.has(slug)) continue;
    await db
      .insert(categoriesTable)
      .values({ slug, name: cat.name, description: cat.description, sortOrder: nextSortOrder++ })
      .onConflictDoNothing({ target: categoriesTable.slug });
    knownSlugs.add(slug);
  }

  const all = await db.select().from(categoriesTable);
  const categorySlugToNewId = new Map(all.map((c) => [c.slug, c.id]));
  return { categorySlugToNewId, categoryOldIdToSlug, oldCount: legacyCategories.length };
}

async function migrateUsers(
  legacy: Client,
  db: Db,
): Promise<{ authorIdMap: Map<number, string>; oldCount: number; newCount: number }> {
  const { rows } = await legacy.query<LegacyUser>(
    'SELECT id, google_id, email, display_name, avatar_url, role, created_at FROM users ORDER BY id',
  );

  const authorIdMap = new Map<number, string>();
  for (const row of rows) {
    const { user, account, oldId } = mapUser(row);
    await db.insert(userTable).values(user);
    await db.insert(accountTable).values(account);
    authorIdMap.set(oldId, user.id);
  }

  return { authorIdMap, oldCount: rows.length, newCount: authorIdMap.size };
}

async function migratePosts(
  legacy: Client,
  db: Db,
  authorIdMap: Map<number, string>,
): Promise<{ postIdMap: Map<number, number>; oldPosts: LegacyPost[] }> {
  const { rows } = await legacy.query<LegacyPost>('SELECT * FROM posts ORDER BY id');

  const postIdMap = new Map<number, number>();
  for (const old of rows) {
    const newPost = mapPost(old, authorIdMap);
    const [inserted] = await db.insert(postsTable).values(newPost).returning({ id: postsTable.id });
    postIdMap.set(old.id, inserted!.id);
  }

  return { postIdMap, oldPosts: rows };
}

async function migrateTranslations(
  legacy: Client,
  db: Db,
  oldPosts: LegacyPost[],
  postIdMap: Map<number, number>,
): Promise<{ warnings: string[]; oldCount: number; newCount: number }> {
  const { rows } = await legacy.query<LegacyTranslation>(
    'SELECT post_id, language, title, content, excerpt, meta_description FROM post_translations ORDER BY post_id, language',
  );

  const rowsByPostId = new Map<number, LegacyTranslation[]>();
  for (const row of rows) {
    const list = rowsByPostId.get(row.post_id) ?? [];
    list.push(row);
    rowsByPostId.set(row.post_id, list);
  }

  const warnings: string[] = [];
  let newCount = 0;
  for (const old of oldPosts) {
    const newPostId = postIdMap.get(old.id);
    if (newPostId == null) continue; // every old post was just inserted; defensive only

    const { translations, warnings: rowWarnings } = buildTranslations(old, rowsByPostId.get(old.id) ?? []);
    warnings.push(...rowWarnings);

    for (const t of translations) {
      await db
        .insert(postTranslations)
        .values({
          postId: newPostId,
          language: t.language,
          title: t.title,
          excerpt: t.excerpt,
          content: t.content,
          metaDescription: t.metaDescription,
        })
        .onConflictDoNothing({ target: [postTranslations.postId, postTranslations.language] });
      newCount++;
    }
  }

  return { warnings, oldCount: rows.length, newCount };
}

async function migratePostCategories(
  legacy: Client,
  db: Db,
  postIdMap: Map<number, number>,
  categoryOldIdToSlug: Map<number, string>,
  categorySlugToNewId: Map<string, number>,
): Promise<{ oldCount: number; newCount: number }> {
  const { rows } = await legacy.query<{ post_id: number; category_id: number }>(
    'SELECT post_id, category_id FROM post_categories',
  );

  let newCount = 0;
  for (const row of rows) {
    const newPostId = postIdMap.get(row.post_id);
    const slug = categoryOldIdToSlug.get(row.category_id);
    const newCategoryId = slug != null ? categorySlugToNewId.get(slug) : undefined;
    if (newPostId == null || newCategoryId == null) continue;

    await db.insert(postCategories).values({ postId: newPostId, categoryId: newCategoryId }).onConflictDoNothing();
    newCount++;
  }

  return { oldCount: rows.length, newCount };
}

interface PostRow {
  id: number;
  slug: string;
}

interface ThumbnailRow {
  thumbnail_path: string;
}

interface SampleRow {
  slug: string;
  language: string;
  title: string;
}

async function buildReport(
  pool: Pool,
  counts: { users: CountRow; categories: CountRow; posts: CountRow; postTranslations: CountRow; postCategories: CountRow },
  warnings: string[],
): Promise<MigrationReport> {
  const { rows: withoutTranslations } = await pool.query<PostRow>(
    `SELECT p.id, p.slug FROM posts p LEFT JOIN post_translations pt ON pt.post_id = p.id WHERE pt.id IS NULL ORDER BY p.id`,
  );

  const { rows: thumbnailRows } = await pool.query<ThumbnailRow>(
    `SELECT DISTINCT thumbnail_path FROM posts WHERE thumbnail_path IS NOT NULL`,
  );
  const uploadsDir = process.env['UPLOADS_DIR'];
  const thumbnailFilenames = thumbnailRows.map((r) => r.thumbnail_path);
  const missingThumbnails = findMissingThumbnails(uploadsDir, thumbnailFilenames);

  const { rows: sampleRows } = await pool.query<SampleRow>(
    `SELECT p.slug, pt.language, pt.title FROM posts p
     JOIN post_translations pt ON pt.post_id = p.id
     WHERE p.id IN (SELECT id FROM posts ORDER BY id LIMIT 3)
     ORDER BY p.id, pt.language`,
  );
  const samplesBySlug = new Map<string, SampleSlug>();
  for (const row of sampleRows) {
    const entry = samplesBySlug.get(row.slug) ?? { slug: row.slug, titles: {} };
    entry.titles[row.language] = row.title;
    samplesBySlug.set(row.slug, entry);
  }

  return {
    counts: [counts.users, counts.categories, counts.posts, counts.postTranslations, counts.postCategories],
    postsWithoutTranslations: withoutTranslations,
    warnings,
    missingThumbnails,
    uploadsDirChecked: uploadsDir ? resolve(uploadsDir, 'originals') : null,
    samples: [...samplesBySlug.values()],
  };
}

async function main(): Promise<number> {
  const legacy = new Client({ connectionString: LEGACY_DATABASE_URL });
  const { db, pool } = createDb(DATABASE_URL);
  await legacy.connect();

  try {
    console.log(`migrate-legacy: ${LEGACY_DATABASE_URL} -> ${DATABASE_URL}`);

    console.log('truncating target content + auth tables...');
    await truncateTarget(pool);

    console.log('migrating categories...');
    const { categorySlugToNewId, categoryOldIdToSlug, oldCount: oldCategoryCount } = await migrateCategories(legacy, db);

    console.log('migrating users + accounts...');
    const { authorIdMap, oldCount: oldUserCount, newCount: newUserCount } = await migrateUsers(legacy, db);

    console.log('migrating posts...');
    const { postIdMap, oldPosts } = await migratePosts(legacy, db, authorIdMap);

    console.log('migrating post_translations...');
    const {
      warnings,
      oldCount: oldTranslationCount,
      newCount: newTranslationCount,
    } = await migrateTranslations(legacy, db, oldPosts, postIdMap);

    console.log('migrating post_categories...');
    const { oldCount: oldPostCategoryCount, newCount: newPostCategoryCount } = await migratePostCategories(
      legacy,
      db,
      postIdMap,
      categoryOldIdToSlug,
      categorySlugToNewId,
    );

    const { rows: newCategoryRows } = await pool.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM categories');

    const report = await buildReport(
      pool,
      {
        users: { table: 'users', oldCount: oldUserCount, newCount: newUserCount, strict: true },
        categories: { table: 'categories', oldCount: oldCategoryCount, newCount: newCategoryRows[0]!.count, strict: false },
        posts: { table: 'posts', oldCount: oldPosts.length, newCount: postIdMap.size, strict: true },
        postTranslations: {
          table: 'post_translations',
          oldCount: oldTranslationCount,
          newCount: newTranslationCount,
          strict: false,
        },
        postCategories: {
          table: 'post_categories',
          oldCount: oldPostCategoryCount,
          newCount: newPostCategoryCount,
          strict: true,
        },
      },
      warnings,
    );

    console.log('');
    console.log(formatReport(report));

    return reportHasFailures(report) ? 1 : 0;
  } finally {
    await legacy.end();
    await pool.end();
  }
}

main()
  .then((exitCode) => process.exit(exitCode))
  .catch((error) => {
    console.error('migrate-legacy failed:', error);
    process.exit(1);
  });
