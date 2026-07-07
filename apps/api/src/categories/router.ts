import { asc } from 'drizzle-orm';
import { categories } from '@carnaby/db';
import { publicProcedure, router } from '../trpc/trpc';

export const categoriesRouter = router({
  list: publicProcedure.query(({ ctx }) =>
    ctx.db.select({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      description: categories.description,
    }).from(categories).orderBy(asc(categories.sortOrder))),
});
