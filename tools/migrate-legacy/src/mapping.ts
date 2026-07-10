import { randomBytes } from 'node:crypto';
import { LANGUAGES, type Language } from '@carnaby/shared';

// ---------------------------------------------------------------------------
// Legacy (v1) row shapes. These mirror the raw snake_case column names `pg`
// returns for the old Express/EJS-era schema (see migrations/002, 003, 005,
// 007, 008 -- `git show carnaby-sk-origin:migrations/<file>.sql`). There's no
// drizzle schema for v1 in code, so these are hand-written from the SQL.
// ---------------------------------------------------------------------------

export interface LegacyUser {
  id: number;
  google_id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string | null;
  created_at: Date;
}

export interface LegacyPost {
  id: number;
  title: string;
  slug: string;
  content: string | null;
  excerpt: string | null;
  thumbnail_path: string | null;
  youtube_id: string | null;
  soundcloud_url: string | null;
  author_id: number | null;
  created_at: Date;
  updated_at: Date;
  published_at: Date | null;
  view_count: number;
  status: string;
  is_featured: boolean;
  meta_description: string | null;
  language: string;
}

export interface LegacyTranslation {
  post_id: number;
  language: string;
  title: string;
  content: string | null;
  excerpt: string | null;
  meta_description: string | null;
}

// ---------------------------------------------------------------------------
// v2 (new) row shapes -- plain objects shaped for drizzle's `.values()` against
// `@carnaby/db`'s `user`/`account`/`posts`/`postTranslations` tables.
// ---------------------------------------------------------------------------

export interface NewUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  role: string;
  createdAt: Date;
}

export interface NewAccount {
  id: string;
  accountId: string;
  providerId: 'google';
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MappedUser {
  user: NewUser;
  account: NewAccount;
  oldId: number;
}

export type PostStatus = 'draft' | 'published' | 'archived';

export interface NewPost {
  slug: string;
  status: PostStatus;
  isFeatured: boolean;
  thumbnailPath: string | null;
  youtubeId: string | null;
  soundcloudUrl: string | null;
  authorId: string | null;
  viewCount: number;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewTranslation {
  /**
   * The OLD (legacy) post id -- `buildTranslations` is a pure function with no access to the
   * old->new post id map (that only exists once posts have actually been inserted), so it hands
   * back the legacy id here. `migrate.ts` remaps this to the new serial post id right before
   * insert, via the `Map<oldPostId, newPostId>` built while inserting posts.
   */
  postId: number;
  language: Language;
  title: string;
  excerpt: string | null;
  content: string;
  metaDescription: string | null;
}

export interface BuildTranslationsResult {
  translations: NewTranslation[];
  /** Human-readable notes for the report's WARN section -- e.g. rows skipped for carrying an
   * unsupported language (anything other than sk|en). */
  warnings: string[];
}

const POST_STATUSES: readonly PostStatus[] = ['draft', 'published', 'archived'];
const SUPPORTED_LANGUAGES: readonly string[] = LANGUAGES;

/**
 * Returns the final path segment, splitting on both `/` and `\` regardless of the host OS --
 * `node:path`'s `basename` only splits on the platform's own separator, which would silently
 * fail to strip a `\`-delimited legacy path when this script runs on Linux (and vice versa).
 */
function toBasename(filePath: string): string {
  const segments = filePath.split(/[\\/]+/).filter((s) => s.length > 0);
  return segments.length > 0 ? segments[segments.length - 1]! : filePath;
}

function normalizeStatus(status: string): PostStatus {
  return (POST_STATUSES as readonly string[]).includes(status) ? (status as PostStatus) : 'draft';
}

function normalizeLanguage(language: string): Language | null {
  const lower = language.trim().toLowerCase();
  return SUPPORTED_LANGUAGES.includes(lower) ? (lower as Language) : null;
}

function nonEmpty(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Maps one legacy `users` row to the v2 `user` + `account` rows that preserve the original
 * Google login identity (the `account.accountId` stays the legacy `google_id`, so returning
 * users sign in with the same account after cutover).
 */
export function mapUser(old: LegacyUser): MappedUser {
  const userId = randomBytes(16).toString('hex');
  const name = old.display_name ?? old.email.split('@')[0]!;
  return {
    user: {
      id: userId,
      name,
      email: old.email,
      emailVerified: true,
      image: old.avatar_url ?? null,
      role: old.role ?? 'user',
      createdAt: old.created_at,
    },
    account: {
      id: randomBytes(16).toString('hex'),
      accountId: old.google_id,
      providerId: 'google',
      userId,
      createdAt: old.created_at,
      updatedAt: old.created_at,
    },
    oldId: old.id,
  };
}

/**
 * Maps one legacy `posts` row to a v2 `posts` row. `authorIdMap` is the old->new user id map
 * built while migrating users; an author that can't be resolved (shouldn't happen since v1's
 * `author_id` is a NOT NULL FK, but defend anyway) maps to `null` per the v2 schema's
 * `ON DELETE SET NULL` author FK.
 */
export function mapPost(old: LegacyPost, authorIdMap: Map<number, string>): NewPost {
  return {
    slug: old.slug,
    status: normalizeStatus(old.status),
    isFeatured: old.is_featured,
    thumbnailPath: old.thumbnail_path ? toBasename(old.thumbnail_path) : null,
    youtubeId: old.youtube_id,
    soundcloudUrl: old.soundcloud_url,
    authorId: old.author_id != null ? authorIdMap.get(old.author_id) ?? null : null,
    viewCount: old.view_count,
    publishedAt: old.published_at,
    createdAt: old.created_at,
    updatedAt: new Date(),
  };
}

/**
 * Builds the v2 `post_translations` rows for one legacy post: copies every real
 * `post_translations` row whose language normalizes to sk|en (dropping anything else with a
 * warning), then -- only for the post's own legacy `language` column, and only if no real row
 * already covers it -- synthesizes one more translation from the legacy `posts.title`/`content`/
 * `excerpt`/`meta_description` columns (the pre-i18n dual content model). Real rows always win
 * over synthesized ones for the same language.
 */
export function buildTranslations(old: LegacyPost, rows: LegacyTranslation[]): BuildTranslationsResult {
  const warnings: string[] = [];
  const byLanguage = new Map<Language, NewTranslation>();

  for (const row of rows) {
    const language = normalizeLanguage(row.language);
    if (!language) {
      warnings.push(
        `post ${old.id} (${old.slug}): post_translations row has unsupported language "${row.language}" -- skipped`,
      );
      continue;
    }
    byLanguage.set(language, {
      postId: old.id,
      language,
      title: row.title,
      excerpt: row.excerpt ?? null,
      content: row.content ?? '',
      metaDescription: row.meta_description ?? null,
    });
  }

  const legacyLanguage = normalizeLanguage(old.language);
  if (!legacyLanguage) {
    warnings.push(`post ${old.id} (${old.slug}): legacy posts.language "${old.language}" is unsupported -- no synthesis attempted`);
  } else if (!byLanguage.has(legacyLanguage) && nonEmpty(old.title) && nonEmpty(old.content)) {
    byLanguage.set(legacyLanguage, {
      postId: old.id,
      language: legacyLanguage,
      title: old.title,
      excerpt: old.excerpt ?? null,
      content: old.content ?? '',
      metaDescription: old.meta_description ?? null,
    });
  }

  return { translations: [...byLanguage.values()], warnings };
}
