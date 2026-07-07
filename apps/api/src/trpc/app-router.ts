import { postsRouter } from '../posts/routers';
import { publicProcedure, router } from './trpc';

export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true })),
  posts: postsRouter,
});
export type AppRouter = typeof appRouter;
