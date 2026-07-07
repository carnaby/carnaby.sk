import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '@carnaby/db';
import { categories, postCategories, postStatusEnum, posts, postTranslations } from '@carnaby/db';
import { LANGUAGES, type Language } from '@carnaby/shared';

export function pickTranslation<T extends { language: Language }>(list: T[], requested: Language): T | undefined {
  return list.find((t) => t.language === requested) ?? list.find((t) => t.language !== requested);
}

export type PostStatus = (typeof postStatusEnum.enumValues)[number];

export interface ListArgs {
  language: Language;
  category?: string;
  featured?: boolean;
  page: number;
  limit: number;
  statuses: PostStatus[];
}

export interface PostListItem {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  thumbnailPath: string | null;
  youtubeId: string | null;
  isFeatured: boolean;
  viewCount: number;
  publishedAt: string | null;
  language: Language;
  categories: { slug: string; name: string }[];
}

export type PostDetail = PostListItem & {
  content: string;
  metaDescription: string | null;
  soundcloudUrl: string | null;
  availableLanguages: Language[];
};

export interface ListResult {
  items: PostListItem[];
  total: number;
  page: number;
  pageCount: number;
}

export async function listPosts(db: Db, args: ListArgs): Promise<ListResult> {
  const where = and(
    inArray(posts.status, args.statuses),
    args.featured === undefined ? undefined : eq(posts.isFeatured, args.featured),
    // NOTE: `=== undefined` (not a truthy check) so an explicit `category: ''` filters to
    // zero results instead of silently behaving like "no filter" — mirrors the `featured` check above.
    args.category === undefined
      ? undefined
      : inArray(posts.id, db.select({ id: postCategories.postId }).from(postCategories)
          .innerJoin(categories, eq(categories.id, postCategories.categoryId))
          .where(eq(categories.slug, args.category))),
  );

  // Count and rows only depend on `where`, not on each other — safe to run concurrently.
  const [countRows, rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(posts).where(where),
    db.select().from(posts).where(where)
      // `publishedAt` is nullable (a post can reach `status='published'` without it being
      // backfilled by whatever future write-path does that transition); default SQL DESC
      // ordering is NULLS FIRST, which would otherwise pin such a post above genuinely
      // recent ones. `nulls last` falls back to `createdAt` ordering for that edge case.
      .orderBy(sql`${posts.publishedAt} desc nulls last`, desc(posts.createdAt))
      .limit(args.limit).offset((args.page - 1) * args.limit),
  ]);
  const total = countRows[0]?.count ?? 0;

  const ids = rows.map((r) => r.id);
  // Translations/categories both depend only on `ids` (from the query above), not on each
  // other — safe to run concurrently. Skip the round-trip entirely when there's nothing to fetch.
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

  const items = rows.flatMap((p): PostListItem[] => {
    const tr = pickTranslation(translations.filter((t) => t.postId === p.id), args.language);
    if (!tr) return [];
    return [{
      id: p.id,
      slug: p.slug,
      title: tr.title,
      excerpt: tr.excerpt,
      thumbnailPath: p.thumbnailPath,
      youtubeId: p.youtubeId,
      isFeatured: p.isFeatured,
      viewCount: p.viewCount,
      publishedAt: p.publishedAt?.toISOString() ?? null,
      language: tr.language,
      categories: cats.filter((c) => c.postId === p.id).map(({ slug, name }) => ({ slug, name })),
    }];
  });

  return { items, total, page: args.page, pageCount: Math.max(1, Math.ceil(total / args.limit)) };
}

export async function getPostBySlug(
  db: Db,
  slug: string,
  language: Language,
  opts: { publishedOnly: boolean },
): Promise<PostDetail | null> {
  const [post] = await db.select().from(posts).where(eq(posts.slug, slug)).limit(1);
  if (!post) return null;
  if (opts.publishedOnly && post.status !== 'published') return null;

  // Both queries depend only on `post.id`, not on each other — safe to run concurrently.
  // (Rare edge case: a post with zero translations in either language still pays for the
  // categories round-trip even though the result below is `null` — negligible cost against
  // the round-trip saved on every normal request, which is the common case for this path.)
  const [translations, cats] = await Promise.all([
    db.select().from(postTranslations).where(eq(postTranslations.postId, post.id)),
    db.select({ slug: categories.slug, name: categories.name })
      .from(postCategories).innerJoin(categories, eq(categories.id, postCategories.categoryId))
      .where(eq(postCategories.postId, post.id)),
  ]);
  const tr = pickTranslation(translations, language);
  if (!tr) return null;

  // Canonical order (matches @carnaby/shared's LANGUAGES), not incidental lexicographic sort.
  const availableLanguages = LANGUAGES.filter((l) => translations.some((t) => t.language === l));

  return {
    id: post.id,
    slug: post.slug,
    title: tr.title,
    excerpt: tr.excerpt,
    thumbnailPath: post.thumbnailPath,
    youtubeId: post.youtubeId,
    isFeatured: post.isFeatured,
    viewCount: post.viewCount,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    language: tr.language,
    categories: cats,
    content: tr.content,
    metaDescription: tr.metaDescription,
    soundcloudUrl: post.soundcloudUrl,
    availableLanguages,
  };
}
