'use client';

// See `lib/trpc-server.ts` for the rationale behind the type-only `@carnaby/api` import and the
// module-boundary lint suppression -- same deal here, just for the react-query-backed client used
// by the admin area (Tasks 20-22). `lib/trpc-browser.ts`'s plain `trpcBrowser` client stays as-is
// for the one non-admin client caller (`ViewTracker`) that doesn't need query caching.
// eslint-disable-next-line @nx/enforce-module-boundaries
import type { AppRouter } from '@carnaby/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCContext } from '@trpc/tanstack-react-query';
import { useState } from 'react';

const { TRPCProvider: TRPCQueryProvider, useTRPC } = createTRPCContext<AppRouter>();

/** Admin pages call `const trpc = useTRPC()` then e.g.
 * `useQuery(trpc.posts.adminList.queryOptions({ ... }))` -- see @trpc/tanstack-react-query docs. */
export { useTRPC };

export interface TRPCProviderProps {
  children: React.ReactNode;
}

/**
 * Client-side tRPC + TanStack Query provider for the admin area (Tasks 20-22). Mounted once,
 * inside the (server-component) admin layout -- a client provider nested inside a server layout
 * is the standard App Router pattern, and it's what lets `/admin/**` pages call `useTRPC()`.
 *
 * `url: '/trpc'` is the same same-origin relative path `lib/trpc-browser.ts` uses:
 * `next.config.js`'s `rewrites()` proxies it to the api, so this works unmodified in the browser.
 *
 * The `QueryClient` and the tRPC client are both created inside `useState`'s lazy initializer so
 * each is built exactly once per mounted provider instance rather than on every render.
 */
export function TRPCProvider({ children }: TRPCProviderProps) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [httpBatchLink({ url: '/trpc' })],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCQueryProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCQueryProvider>
    </QueryClientProvider>
  );
}
