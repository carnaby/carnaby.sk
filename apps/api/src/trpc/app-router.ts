import { categoriesRouter } from '../categories/router';
import { postsRouter } from '../posts/routers';
import { usersRouter } from '../users/router';
import { publicProcedure, router } from './trpc';

export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true })),
  posts: postsRouter,
  categories: categoriesRouter,
  users: usersRouter,
});
export type AppRouter = typeof appRouter;
