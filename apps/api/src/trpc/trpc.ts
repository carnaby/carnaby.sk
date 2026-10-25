import { TRPCError, initTRPC } from '@trpc/server';
import type { Context } from './context';

const t = initTRPC.context<Context>().create({
  // Unexpected errors (a failed SQL query, a bug) must not leak their message -- drizzle's
  // includes the full query and parameters -- or a stack trace to the browser. They are logged
  // server-side by the `onError` handler in trpc.module.ts. Deliberate TRPCErrors (NOT_FOUND,
  // CONFLICT, ...) keep their message.
  errorFormatter({ shape, error }) {
    if (error.code !== 'INTERNAL_SERVER_ERROR') return shape;
    return {
      ...shape,
      message: 'Internal server error',
      data: { ...shape.data, stack: undefined },
    };
  },
});
export const router = t.router;
export const publicProcedure = t.procedure;
export const adminProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
  if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
  return next({ ctx: { ...ctx, user: ctx.user } });
});
