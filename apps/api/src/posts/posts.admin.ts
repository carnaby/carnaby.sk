import { promises as fs } from 'node:fs';
import path from 'node:path';
import { and, eq, inArray } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import type { Db } from '@carnaby/db';
import { categories, postCategories, posts, postTranslations } from '@carnaby/db';
import type { Language, PostUpsertInput, TranslationInput } from '@carnaby/shared';
import { pickTranslation, type PostListItem, type PostStatus } from './posts.read';

export type AdminSortBy = 'createdAt' | 'publishedAt' | 'title' | 'status' | 'viewCount';
export type SortOrder = 'asc' | 'desc';

export interface AdminListArgs {
  status?: PostStatus;
  category?: string;
  featured?: boolean;
  page: number;
  limit: number;
  sortBy: AdminSortBy;
  order: SortOrder;
}

export type AdminListItem = PostListItem & {
  status: PostStatus;
  createdAt: string;
  hasSk: boolean;
  hasEn: boolean;
};

export interface AdminListResult {
  items: AdminListItem[];
  total: number;
  page: number;
  pageCount: number;
}

export interface PostById {
  post: {
    id: number;
    slug: string;
    status: PostStatus;
    isFeatured: boolean;
    thumbnailPath: string | null;
    youtubeId: string | null;
    soundcloudUrl: string | null;
    publishedAt: string | null;
    viewCount: number;
  };
  translations: { sk: TranslationInput | null; en: TranslationInput | null };
  categoryIds: number[];
}

// Admin lists are small (an operator's own back-catalog, not a public feed), and `title`
// (the most requested admin sort) doesn't exist as a plain column — it's the sk→en fallback
// of a joined translation, which SQL `ORDER BY ... LIMIT/OFFSET` can't express without a lot
// of ceremony. Filtering happens in SQL (still cheap, still uses the category/status indexes
// via `where`); sorting + pagination happen in JS over the (small) filtered set.
export async function adminListPosts(db: Db, args: AdminListArgs): Promise<AdminListResult> {
  const where = and(
    args.status === undefined ? undefined : eq(posts.status, args.status),
    args.featured === undefined ? undefined : eq(posts.isFeatured, args.featured),
    args.category === undefined
      ? undefined
      : inArray(posts.id, db.select({ id: postCategories.postId }).from(postCategories)
          .innerJoin(categories, eq(categories.id, postCategories.categoryId))
          .where(eq(categories.slug, args.category))),
  );

  const rows = await db.select().from(posts).where(where);
  const total = rows.length;
  const ids = rows.map((r) => r.id);

  const [translations, cats] = ids.length
    ? await Promise.all([
        db.select({
          postId: postTranslations.postId,
          language: postTranslations.language,
          title: postTranslations.title,
          excerpt: postTranslations.excerpt,
        }).from(postTranslations).where(inArray(postTranslations.postId, ids)),
        db.select({ postId: postCategories.postId, slug: categories.slug, name: categories.name })
          .from(postCategories).innerJoin(categories, eq(categories.id, postCategories.categoryId))
          .where(inArray(postCategories.postId, ids)),
      ])
    : [[], []];

  const items: AdminListItem[] = rows.map((p): AdminListItem => {
    const postTr = translations.filter((t) => t.postId === p.id);
    const hasSk = postTr.some((t) => t.language === 'sk');
    const hasEn = postTr.some((t) => t.language === 'en');
    // Display title always prefers sk, falling back to en — independent of what a caller
    // requests elsewhere for public reads (this is the admin table, not localized content).
    const tr = pickTranslation(postTr, 'sk');
    return {
      id: p.id,
      slug: p.slug,
      title: tr?.title ?? '',
      excerpt: tr?.excerpt ?? null,
      thumbnailPath: p.thumbnailPath,
      youtubeId: p.youtubeId,
      isFeatured: p.isFeatured,
      viewCount: p.viewCount,
      publishedAt: p.publishedAt?.toISOString() ?? null,
      language: tr?.language ?? 'sk',
      categories: cats.filter((c) => c.postId === p.id).map(({ slug, name }) => ({ slug, name })),
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      hasSk,
      hasEn,
    };
  });

  const dir = args.order === 'asc' ? 1 : -1;
  items.sort((a, b) => {
    switch (args.sortBy) {
      case 'title': return dir * a.title.localeCompare(b.title);
      case 'status': return dir * a.status.localeCompare(b.status);
      case 'viewCount': return dir * (a.viewCount - b.viewCount);
      case 'publishedAt': return dir * (a.publishedAt ?? '').localeCompare(b.publishedAt ?? '');
      case 'createdAt':
      default: return dir * a.createdAt.localeCompare(b.createdAt);
    }
  });

  const start = (args.page - 1) * args.limit;
  const paged = items.slice(start, start + args.limit);

  return { items: paged, total, page: args.page, pageCount: Math.max(1, Math.ceil(total / args.limit)) };
}

export async function getPostById(db: Db, id: number): Promise<PostById> {
  const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!post) throw new TRPCError({ code: 'NOT_FOUND' });

  const [translations, catRows] = await Promise.all([
    db.select().from(postTranslations).where(eq(postTranslations.postId, id)),
    db.select({ categoryId: postCategories.categoryId }).from(postCategories).where(eq(postCategories.postId, id)),
  ]);
  const toTranslationInput = (t: (typeof translations)[number] | undefined): TranslationInput | null =>
    t ? { title: t.title, excerpt: t.excerpt ?? undefined, content: t.content, metaDescription: t.metaDescription ?? undefined } : null;

  return {
    post: {
      id: post.id,
      slug: post.slug,
      status: post.status,
      isFeatured: post.isFeatured,
      thumbnailPath: post.thumbnailPath,
      youtubeId: post.youtubeId,
      soundcloudUrl: post.soundcloudUrl,
      publishedAt: post.publishedAt?.toISOString() ?? null,
      viewCount: post.viewCount,
    },
    translations: {
      sk: toTranslationInput(translations.find((t) => t.language === 'sk')),
      en: toTranslationInput(translations.find((t) => t.language === 'en')),
    },
    categoryIds: catRows.map((c) => c.categoryId),
  };
}

export function isSafeThumbnailPath(path: string): boolean {
  // Reject paths that could escape the uploads directory: no slashes (path separators),
  // no leading dots (relative paths), no absolute paths.
  return !/[/\\]/.test(path) && !path.startsWith('.') && !path.startsWith('/') && !path.match(/^[a-zA-Z]:/);
}

interface PostgresError {
  code?: string;
  constraint?: string;
}

function isUniqueViolation(error: unknown): { isViolation: boolean; constraintName?: string } {
  // node-postgres surfaces a Postgres error as a plain object (not a subclass we can
  // `instanceof`-check) with the driver's numeric SQLSTATE on `.code`; 23505 is
  // unique_violation.
  if (typeof error === 'object' && error !== null && (error as PostgresError).code === '23505') {
    return { isViolation: true, constraintName: (error as PostgresError).constraint };
  }
  return { isViolation: false };
}

export async function upsertPost(db: Db, input: PostUpsertInput & { id?: number }, authorId: string): Promise<{ id: number }> {
  try {
    return await db.transaction(async (tx) => {
      const base = {
        slug: input.slug, status: input.status, isFeatured: input.isFeatured,
        thumbnailPath: input.thumbnailPath ?? null, youtubeId: input.youtubeId ?? null,
        soundcloudUrl: input.soundcloudUrl ?? null, updatedAt: new Date(),
      };
      let id = input.id;
      if (id == null) {
        const [row] = await tx.insert(posts)
          .values({ ...base, authorId, publishedAt: input.status === 'published' ? new Date() : null })
          .returning({ id: posts.id });
        id = row!.id;
      } else {
        const [existing] = await tx.select({ publishedAt: posts.publishedAt }).from(posts).where(eq(posts.id, id));
        if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
        await tx.update(posts)
          .set({ ...base, publishedAt: input.status === 'published' ? existing.publishedAt ?? new Date() : existing.publishedAt })
          .where(eq(posts.id, id));
      }
      const langs: Language[] = ['sk', 'en'];
      for (const lang of langs) {
        const tr = input.translations[lang];
        if (tr) {
          await tx.insert(postTranslations)
            .values({ postId: id, language: lang, title: tr.title, excerpt: tr.excerpt ?? null, content: tr.content, metaDescription: tr.metaDescription ?? null, updatedAt: new Date() })
            .onConflictDoUpdate({
              target: [postTranslations.postId, postTranslations.language],
              set: { title: tr.title, excerpt: tr.excerpt ?? null, content: tr.content, metaDescription: tr.metaDescription ?? null, updatedAt: new Date() },
            });
        } else {
          await tx.delete(postTranslations).where(and(eq(postTranslations.postId, id), eq(postTranslations.language, lang)));
        }
      }
      await tx.delete(postCategories).where(eq(postCategories.postId, id));
      const uniqueCategoryIds = [...new Set(input.categoryIds)];
      if (uniqueCategoryIds.length) {
        await tx.insert(postCategories).values(uniqueCategoryIds.map((categoryId) => ({ postId: id!, categoryId })));
      }
      return { id };
    });
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    const violation = isUniqueViolation(error);
    if (violation.isViolation) {
      // Only map to the slug message if the constraint is specifically the slug constraint
      if (violation.constraintName?.includes('slug')) {
        throw new TRPCError({ code: 'CONFLICT', message: 'slug already in use' });
      }
      // For other unique violations, return a generic CONFLICT with the constraint name
      throw new TRPCError({ code: 'CONFLICT', message: `constraint violation: ${violation.constraintName || 'unknown'}` });
    }
    throw error;
  }
}

export async function removePost(db: Db, id: number): Promise<void> {
  const [post] = await db.select({ thumbnailPath: posts.thumbnailPath }).from(posts).where(eq(posts.id, id));
  if (!post) throw new TRPCError({ code: 'NOT_FOUND' });

  // `post_translations`/`post_categories` rows cascade-delete via their FK `onDelete: 'cascade'`
  // — no manual cleanup needed for those.
  await db.delete(posts).where(eq(posts.id, id));

  // Best-effort thumbnail cleanup: Task 10 owns the real UploadsService (validation, storage
  // abstraction, etc.) — this inline unlink is a placeholder Task 10 can absorb/replace. Guarded
  // by `UPLOADS_DIR` being set and swallows all errors so a missing file, missing env var, or
  // filesystem hiccup never turns a successful DB delete into a failed `remove` call.
  if (post.thumbnailPath && process.env['UPLOADS_DIR'] && isSafeThumbnailPath(post.thumbnailPath)) {
    try {
      const base = path.resolve(process.env['UPLOADS_DIR'], 'originals');
      const target = path.resolve(base, post.thumbnailPath);
      // Verify the resolved target stays within the base directory to prevent path traversal
      if (target.startsWith(base + path.sep) || target === base) {
        await fs.unlink(target);
      }
    } catch {
      // ignore — best-effort only
    }
  }
}
