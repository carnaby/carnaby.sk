import { postStatusSchema } from '@carnaby/shared';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { adminProcedure, router } from '../trpc/trpc';
import { YoutubeApiError, YoutubeNotConfiguredError, YoutubeVideoNotFoundError } from './youtube.client';
import { importYoutubeVideo, previewYoutubeVideo, youtubeOverview } from './youtube.service';

const videoId = z.string().regex(/^[A-Za-z0-9_-]{6,20}$/, 'invalid YouTube video id');

/** Turns YouTube failures into messages the admin UI can show as-is. */
async function mapErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof YoutubeNotConfiguredError) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: error.message });
    if (error instanceof YoutubeVideoNotFoundError) throw new TRPCError({ code: 'NOT_FOUND', message: error.message });
    if (error instanceof YoutubeApiError) throw new TRPCError({ code: 'BAD_GATEWAY', message: error.message });
    throw error;
  }
}

export const youtubeRouter = router({
  overview: adminProcedure.input(z.object({ refresh: z.boolean().default(false) }).default({ refresh: false }))
    .query(({ ctx, input }) => mapErrors(() => youtubeOverview(ctx.db, input))),

  /** Data for the post editor's "Načítať z YouTube" button; writes nothing to the database. */
  preview: adminProcedure.input(z.object({ videoId }))
    .mutation(({ input }) => mapErrors(() => previewYoutubeVideo(input.videoId))),

  import: adminProcedure.input(z.object({ videoId, status: postStatusSchema.default('published') }))
    .mutation(({ ctx, input }) => mapErrors(() => importYoutubeVideo(ctx.db, input.videoId, input.status, ctx.user.id))),
});
