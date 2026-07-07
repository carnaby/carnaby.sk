// See `lib/trpc-server.ts` for the rationale behind the type-only `@carnaby/api` import and the
// module-boundary lint suppression -- same deal here, just for client-side calls (currently only
// `posts.incrementViews`, from `components/post/view-tracker.tsx`).
// eslint-disable-next-line @nx/enforce-module-boundaries
import type { AppRouter } from '@carnaby/api';
import { createTRPCClient, httpBatchLink } from '@trpc/client';

/**
 * tRPC client for use from Client Components. `url: '/trpc'` is a same-origin, relative path --
 * `next.config.js`'s `rewrites()` proxies it to the api, so this works unmodified in the browser
 * without needing to know the api's internal address (unlike `trpc-server.ts`'s
 * `API_INTERNAL_URL`, which is only reachable server-side).
 */
export const trpcBrowser = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: '/trpc' })],
});
