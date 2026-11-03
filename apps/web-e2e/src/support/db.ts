import { createHmac, randomBytes } from 'node:crypto';

import { Pool } from 'pg';

import { DATABASE_URL, SLUG_PREFIX, type TestUser } from './env';

/**
 * Direct Postgres access for seeding and cleanup. Plain `pg` + SQL on purpose: no dependency on
 * the workspace's TS path aliases or drizzle build, so the suite only needs a reachable database.
 */
let pool: Pool | undefined;
function db(): Pool {
  pool ??= new Pool({ connectionString: DATABASE_URL, max: 2 });
  return pool;
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
}

export type Language = 'sk' | 'en';
export type PostStatus = 'draft' | 'published' | 'archived';

export interface SeedTranslation {
  title: string;
  content: string;
  excerpt?: string;
}

export interface SeedPost {
  slug: string;
  status?: PostStatus;
  featured?: boolean;
  category?: 'devlog' | 'dodo' | 'carnaby';
  sk?: SeedTranslation;
  en?: SeedTranslation;
}

/** Unique per call: `e2e-test-<tag>-<random>`. */
export function uniqueSlug(tag: string): string {
  return `${SLUG_PREFIX}${tag}-${randomBytes(4).toString('hex')}`;
}

export async function seedPost(post: SeedPost): Promise<{ id: number; slug: string }> {
  const status = post.status ?? 'published';
  const { rows } = await db().query<{ id: number }>(
    `insert into posts (slug, status, is_featured, published_at)
     values ($1, $2, $3, $4) returning id`,
    [post.slug, status, post.featured ?? false, status === 'published' ? new Date() : null],
  );
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`seedPost: insert of ${post.slug} returned no row`);
  for (const language of ['sk', 'en'] as const) {
    const t = post[language];
    if (!t) continue;
    await db().query(
      `insert into post_translations (post_id, language, title, content, excerpt) values ($1, $2, $3, $4, $5)`,
      [id, language, t.title, t.content, t.excerpt ?? null],
    );
  }
  if (post.category) {
    await db().query(
      `insert into post_categories (post_id, category_id) select $1, id from categories where slug = $2`,
      [id, post.category],
    );
  }
  return { id, slug: post.slug };
}

export async function getPost(slug: string): Promise<{ id: number; status: PostStatus; isFeatured: boolean } | null> {
  const { rows } = await db().query<{ id: number; status: PostStatus; is_featured: boolean }>(
    `select id, status, is_featured from posts where slug = $1`,
    [slug],
  );
  const row = rows[0];
  return row ? { id: row.id, status: row.status, isFeatured: row.is_featured } : null;
}

export async function deletePost(slug: string): Promise<void> {
  await db().query(`delete from posts where slug = $1`, [slug]);
}

/** Removes every post this suite ever created (translations/categories cascade). */
export async function deleteAllTestPosts(): Promise<void> {
  await db().query(`delete from posts where slug like $1`, [`${SLUG_PREFIX}%`]);
}

export async function postsByYoutubeId(youtubeId: string): Promise<{ id: number; slug: string; status: PostStatus }[]> {
  const { rows } = await db().query<{ id: number; slug: string; status: PostStatus }>(
    `select id, slug, status from posts where youtube_id = $1 order by id`,
    [youtubeId],
  );
  return rows;
}

export async function deletePostById(id: number): Promise<void> {
  await db().query(`delete from posts where id = $1`, [id]);
}

// --- auth -----------------------------------------------------------------------------------

/** better-auth's session cookie name over plain http (`${prefix}.session_token`, no `__Secure-`). */
export const SESSION_COOKIE = 'better-auth.session_token';

/**
 * (Re)creates `user` with a fresh session and returns the signed cookie value better-auth expects:
 * `${token}.${encodeURIComponent(base64(HMAC-SHA256(secret, token)))}` -- the same signature
 * better-auth's `makeSignature` produces. Real Google OAuth can't run headlessly, so this skips it.
 */
export async function createSessionCookie(user: TestUser, secret: string): Promise<string> {
  await db().query(`delete from "user" where id = $1 or email = $2`, [user.id, user.email]);
  await db().query(
    `insert into "user" (id, name, email, email_verified, role) values ($1, $2, $3, true, $4)`,
    [user.id, user.name, user.email, user.role],
  );
  const token = randomBytes(32).toString('hex');
  await db().query(
    `insert into session (id, token, user_id, expires_at) values ($1, $2, $3, now() + interval '1 day')`,
    [`e2e-session-${randomBytes(16).toString('hex')}`, token, user.id],
  );
  const signature = createHmac('sha256', secret).update(token).digest('base64');
  return `${token}.${encodeURIComponent(signature)}`;
}

/** Sessions cascade with the user row. */
export async function deleteUsers(ids: string[]): Promise<void> {
  await db().query(`delete from "user" where id = any($1)`, [ids]);
}
