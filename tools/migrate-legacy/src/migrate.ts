import 'dotenv/config';
import { resolve } from 'node:path';
import { sql } from 'drizzle-orm';
import { Client, type Pool } from 'pg';
import {
  createDb,
  seedCategories,
  account as accountTable,
  categories as categoriesTable,
  postCategories,
  postTranslations,
  posts as postsTable,
  user as userTable,
} from '@carnaby/db';
import type { Tx } from '@carnaby/db';
import { buildTranslations, mapPost, mapUser } from './mapping';
import type { LegacyPost, LegacyTranslation, LegacyUser } from './mapping';
import { findMissingThumbnails, formatReport, reportHasFailures } from './report';
import type { CountRow, MigrationReport, SampleSlug } from './report';

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
 *
 * Runs on `tx`, the same transaction as every insert below -- TRUNCATE is fully transactional in
 * Postgres, so if any later step throws, this rollback undoes the truncate too and the target db
 * ends up exactly as it was before the run started (see `main`'s `db.transaction(...)`).
 */
async function truncateTarget(tx: Tx): Promise<void> {
  await tx.execute(
    sql`TRUNCATE post_categories, post_translations, posts, categories, "verification", "account", "session", "user" RESTART IDENTITY CASCADE`,
  );
}

async function migrateCategories(
  legacy: Client,
  tx: Tx,
): Promise<{ categorySlugToNewId: Map<string, number>; categoryOldIdToSlug: Map<number, string>; oldCount: number; newCount: number }> {
  await seedCategories(tx); // canonical devlog/dodo/carnaby rows, in the same transaction

  const { rows: legacyCategories } = await legacy.query<{ id: number; name: string; slug: string | null; description: string | null }>(
    'SELECT id, name, slug, description FROM categories ORDER BY id',
  );

  const categoryOldIdToSlug = new Map<number, string>();
  for (const cat of legacyCategories) categoryOldIdToSlug.set(cat.id, cat.slug ?? slugify(cat.name));

  const seeded = await tx.select().from(categoriesTable);
  const knownSlugs = new Set(seeded.map((c) => c.slug));
  let nextSortOrder = seeded.length;

  for (const cat of legacyCategories) {
    const slug = categoryOldIdToSlug.get(cat.id)!;
    if (knownSlugs.has(slug)) continue;
    await tx
      .insert(categoriesTable)
      .values({ slug, name: cat.name, description: cat.description, sortOrder: nextSortOrder++ })
      .onConflictDoNothing({ target: categoriesTable.slug });
    knownSlugs.add(slug);
  }

  const all = await tx.select().from(categoriesTable);
  const categorySlugToNewId = new Map(all.map((c) => [c.slug, c.id]));
  return { categorySlugToNewId, categoryOldIdToSlug, oldCount: legacyCategories.length, newCount: categorySlugToNewId.size };
}

async function migrateUsers(
  legacy: Client,
  tx: Tx,
): Promise<{ authorIdMap: Map<number, string>; oldCount: number; newCount: number }> {
  const { rows } = await legacy.query<LegacyUser>(
    'SELECT id, google_id, email, display_name, avatar_url, role, created_at FROM users ORDER BY id',
  );

  const authorIdMap = new Map<number, string>();
  for (const row of rows) {
    const { user, account, oldId } = mapUser(row);
    await tx.insert(userTable).values(user);
    await tx.insert(accountTable).values(account);
    authorIdMap.set(oldId, user.id);
  }

  return { authorIdMap, oldCount: rows.length, newCount: authorIdMap.size };
}

async function migratePosts(
  legacy: Client,
  tx: Tx,
  authorIdMap: Map<number, string>,
): Promise<{ postIdMap: Map<number, number>; oldPosts: LegacyPost[] }> {
  const { rows } = await legacy.query<LegacyPost>('SELECT * FROM posts ORDER BY id');

  const postIdMap = new Map<number, number>();
  for (const old of rows) {
    const newPost = mapPost(old, authorIdMap);
    const [inserted] = await tx.insert(postsTable).values(newPost).returning({ id: postsTable.id });
    postIdMap.set(old.id, inserted!.id);
  }

  return { postIdMap, oldPosts: rows };
}

async function migrateTranslations(
  legacy: Client,
  tx: Tx,
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
      await tx
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
  tx: Tx,
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

    await tx.insert(postCategories).values({ postId: newPostId, categoryId: newCategoryId }).onConflictDoNothing();
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

interface AuditedCounts {
  users: number;
  categories: number;
  posts: number;
  postTranslations: number;
  postCategories: number;
}

/**
 * Re-queries actual persisted row counts against `pool` -- called only *after* `main`'s
 * `db.transaction(...)` has resolved (i.e. committed) -- so the report's "new" counts reflect what
 * is really in the target db, not just what the in-memory tallies accumulated while inserting
 * believe happened (Finding 2: in-memory counts alone can't catch a bug where a row silently
 * didn't persist, e.g. a stray `onConflictDoNothing` skip or a trigger).
 */
async function queryAuditedCounts(pool: Pool): Promise<AuditedCounts> {
  const count = async (fromClause: string): Promise<number> => {
    const { rows } = await pool.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM ${fromClause}`);
    return rows[0]!.count;
  };
  const [users, categories, posts, postTranslationsCount, postCategoriesCount] = await Promise.all([
    count('"user"'),
    count('categories'),
    count('posts'),
    count('post_translations'),
    count('post_categories'),
  ]);
  return { users, categories, posts, postTranslations: postTranslationsCount, postCategories: postCategoriesCount };
}

/** Compares each in-memory tally against the corresponding post-commit queried count; returns a
 * human-readable mismatch string per disagreement (empty when everything lines up). */
function auditCounts(inMemory: AuditedCounts, queried: AuditedCounts): string[] {
  const mismatches: string[] = [];
  for (const table of Object.keys(inMemory) as (keyof AuditedCounts)[]) {
    if (inMemory[table] !== queried[table]) {
      mismatches.push(`${table}: in-memory=${inMemory[table]} queried=${queried[table]}`);
    }
  }
  return mismatches;
}

async function buildReport(
  pool: Pool,
  counts: { users: CountRow; categories: CountRow; posts: CountRow; postTranslations: CountRow; postCategories: CountRow },
  warnings: string[],
  auditMismatches: string[],
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
    auditMismatches,
  };
}

async function main(): Promise<number> {
  const legacy = new Client({ connectionString: LEGACY_DATABASE_URL });
  const { db, pool } = createDb(DATABASE_URL);
  await legacy.connect();

  try {
    console.log(`migrate-legacy: ${LEGACY_DATABASE_URL} -> ${DATABASE_URL}`);

    // Finding 1: the whole write side -- truncate + categories + users/accounts + posts +
    // translations + post_categories -- runs as ONE transaction. TRUNCATE is fully transactional
    // in Postgres, so if any step throws (including the MIGRATE_FAIL_INJECT test hook below),
    // Postgres rolls back to the target db's exact pre-run state instead of leaving it
    // truncated-and-half-filled. Report/verification queries run against `pool` further below,
    // strictly after this resolves (i.e. after commit).
    const migrated = await db.transaction(async (tx) => {
      console.log('truncating target content + auth tables...');
      await truncateTarget(tx);

      console.log('migrating categories...');
      const {
        categorySlugToNewId,
        categoryOldIdToSlug,
        oldCount: oldCategoryCount,
        newCount: newCategoryCount,
      } = await migrateCategories(legacy, tx);

      console.log('migrating users + accounts...');
      const { authorIdMap, oldCount: oldUserCount, newCount: newUserCount } = await migrateUsers(legacy, tx);

      console.log('migrating posts...');
      const { postIdMap, oldPosts } = await migratePosts(legacy, tx, authorIdMap);

      // Test-only hook (documented here, not a real feature): forces a failure partway through
      // the transaction so the rollback-safety fix above can be proven end-to-end against a real
      // db -- see the task report for the "success run" + "injected-failure rollback proof" pair.
      // Never set in normal/production use.
      if (process.env['MIGRATE_FAIL_INJECT'] === 'after-posts') {
        throw new Error('MIGRATE_FAIL_INJECT=after-posts: forced failure for rollback test, not a real error');
      }

      console.log('migrating post_translations...');
      const {
        warnings,
        oldCount: oldTranslationCount,
        newCount: newTranslationCount,
      } = await migrateTranslations(legacy, tx, oldPosts, postIdMap);

      console.log('migrating post_categories...');
      const { oldCount: oldPostCategoryCount, newCount: newPostCategoryCount } = await migratePostCategories(
        legacy,
        tx,
        postIdMap,
        categoryOldIdToSlug,
        categorySlugToNewId,
      );

      return {
        oldCategoryCount,
        newCategoryCount,
        oldUserCount,
        newUserCount,
        oldPostCount: oldPosts.length,
        newPostCount: postIdMap.size,
        warnings,
        oldTranslationCount,
        newTranslationCount,
        oldPostCategoryCount,
        newPostCategoryCount,
      };
    });

    console.log('committed.');

    // Finding 2: re-query actual persisted counts now that the transaction has committed, and
    // cross-check them against the in-memory tallies gathered above -- a mismatch here means the
    // migration's own bookkeeping can't be trusted even if the counts happened to look fine, and
    // is always a FAIL (see `report.ts`'s `auditMismatches`).
    const inMemoryCounts: AuditedCounts = {
      users: migrated.newUserCount,
      categories: migrated.newCategoryCount,
      posts: migrated.newPostCount,
      postTranslations: migrated.newTranslationCount,
      postCategories: migrated.newPostCategoryCount,
    };
    const queriedCounts = await queryAuditedCounts(pool);
    const auditMismatches = auditCounts(inMemoryCounts, queriedCounts);

    const report = await buildReport(
      pool,
      {
        users: { table: 'users', oldCount: migrated.oldUserCount, newCount: queriedCounts.users, strict: true },
        categories: { table: 'categories', oldCount: migrated.oldCategoryCount, newCount: queriedCounts.categories, strict: false },
        posts: { table: 'posts', oldCount: migrated.oldPostCount, newCount: queriedCounts.posts, strict: true },
        postTranslations: {
          table: 'post_translations',
          oldCount: migrated.oldTranslationCount,
          newCount: queriedCounts.postTranslations,
          strict: false,
        },
        postCategories: {
          table: 'post_categories',
          oldCount: migrated.oldPostCategoryCount,
          newCount: queriedCounts.postCategories,
          strict: true,
        },
      },
      migrated.warnings,
      auditMismatches,
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
