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
 * tRPC client for use from React Server Components only (guarded by the `server-only` import
 * above).
 *
 * Deliberately uncached (`no-store`): content changes from the admin UI *and* from the MCP
 * endpoint (apps/api/src/mcp) must be visible on the very next request. A tag-based Data Cache
 * would need every writer -- including the api itself -- to call back into Next to invalidate,
 * and Next 16's `revalidateTag(tag, 'max')` is stale-while-revalidate anyway (the first visit
 * after an edit still got the old page). The api sits next to this app on the same host, so the
 * uncached round-trip is a few milliseconds.
 */
export function serverTrpc() {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${API_INTERNAL_URL}/trpc`,
        fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
      }),
    ],
  });
}
