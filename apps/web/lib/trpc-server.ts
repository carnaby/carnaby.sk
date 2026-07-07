import 'server-only';

// `@carnaby/api` resolves to a type-only barrel (apps/api/src/trpc/index.ts
// re-exports only `type AppRouter`); combined with the `import type` here,
// the whole import is erased at compile time, so none of the API's runtime
// code (NestJS, drizzle, better-auth, ...) ever reaches the web bundle. Nx's
// module-boundary rule still flags any import from an "application" project
// (apps/api is one) regardless of it being type-only, so it's silenced here
// deliberately -- this is the sanctioned way for the web app to share the
// tRPC router's type with its client.
// eslint-disable-next-line @nx/enforce-module-boundaries
import type { AppRouter } from '@carnaby/api';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { inferRouterOutputs } from '@trpc/server';

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:3001';

/** Inferred from the tRPC router's return type rather than duplicated by hand — stays in sync
 * with `apps/api/src/posts/posts.read.ts`'s `PostListItem` without importing api runtime code. */
export type PostListItem = inferRouterOutputs<AppRouter>['posts']['list']['items'][number];

/**
 * Cache-tag convention shared by every consumer of `serverTrpc`/Next's Data
 * Cache (public pages: Tasks 15-17; revalidation: `lib/revalidate.ts`):
 *   - post lists       -> ['posts']
 *   - post detail      -> tagsFor(slug) === ['posts', 'post:<slug>']
 *   - category listing -> ['categories']
 */
export function tagsFor(slug: string): string[] {
  return ['posts', `post:${slug}`];
}

/**
 * tRPC client for use from React Server Components and Server Actions only
 * (guarded by the `server-only` import above).
 *
 * Pass `tags` to opt the underlying fetch into Next's Data Cache: the
 * response is cached for up to 5 minutes and tagged so
 * `revalidateContent` (`lib/revalidate.ts`) can invalidate it on demand.
 * Omit `tags` (or call with no arguments) for requests that must never be
 * cached, e.g. admin-only reads.
 */
export function serverTrpc(tags?: string[]) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${API_INTERNAL_URL}/trpc`,
        fetch: (url, options) =>
          fetch(url, {
            ...options,
            next: { revalidate: tags ? 300 : 0, tags },
          }),
      }),
    ],
  });
}
