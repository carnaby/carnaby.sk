import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { DEFAULT_LANGUAGE, languageSchema } from '@carnaby/shared';
import { and, eq, sql } from 'drizzle-orm';
import { posts } from '@carnaby/db';
import { publicProcedure, router } from '../trpc/trpc';
import { getPostBySlug, listPosts } from './posts.read';

// Single source of truth for the `list` input defaults — fed into both the per-field
// `.default(...)` calls (used when a field is omitted from an otherwise-present input object)
// and the outer object `.default(...)` (used when the whole input is omitted). zod's outer
// `.default()` value is used as-is, not re-validated against the per-field schemas, so these
// two layers can silently drift if edited independently; naming the values once removes that risk.
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

export const postsRouter = router({
  list: publicProcedure.input(z.object({
    language: languageSchema.default(DEFAULT_LANGUAGE),
    category: z.string().optional(),
    featured: z.boolean().optional(),
    page: z.number().int().min(1).default(DEFAULT_PAGE),
    limit: z.number().int().min(1).max(50).default(DEFAULT_LIMIT),
  }).default({ language: DEFAULT_LANGUAGE, page: DEFAULT_PAGE, limit: DEFAULT_LIMIT })).query(({ ctx, input }) =>
    listPosts(ctx.db, { ...input, statuses: ['published'] })),

  bySlug: publicProcedure.input(z.object({ slug: z.string(), language: languageSchema.default(DEFAULT_LANGUAGE) }))
    .query(async ({ ctx, input }) => {
      const post = await getPostBySlug(ctx.db, input.slug, input.language, { publishedOnly: true });
      if (!post) throw new TRPCError({ code: 'NOT_FOUND' });
      return post;
    }),

  incrementViews: publicProcedure.input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      // Scoped to published posts so a guessable sequential id can't be used to inflate a
      // draft/archived post's view count via this public endpoint; still always returns
      // `{ ok: true }` (no NOT_FOUND) for a nonexistent id, matching an analytics-counter's
      // fire-and-forget contract rather than treating a miss as a client error.
      await ctx.db.update(posts)
        .set({ viewCount: sql`${posts.viewCount} + 1` })
        .where(and(eq(posts.id, input.id), eq(posts.status, 'published')));
      return { ok: true };
    }),
});
