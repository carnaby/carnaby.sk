import { user } from '@carnaby/db';
import { adminProcedure, router } from '../trpc/trpc';

export const usersRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.select({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      createdAt: user.createdAt,
    }).from(user);
    // ISO-string `createdAt` (rather than a raw `Date`) matches the convention used elsewhere
    // in this API (e.g. posts.read's `publishedAt`) — there's no superjson transformer wired
    // into this router, so a `Date` would otherwise arrive as a string on the wire anyway,
    // just without the explicitness of doing it here.
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  }),
});
