'use client';

import { useEffect, useRef, useState } from 'react';

import { trpcBrowser } from '../../lib/trpc-browser';

export interface ViewTrackerProps {
  id: number;
  /** Server-rendered view count to show until the increment below resolves. Comes from a
   * cached `bySlug` read (see `lib/trpc-server.ts`'s `tagsFor`), so it can be a few minutes
   * stale on a frequently-visited post -- this component's own count then takes over. */
  initialCount: number;
}

/**
 * Fires `posts.incrementViews` once per page visit and renders the resulting count in place.
 * Rendering the number here (rather than reading it straight off the page's cached SSR fetch)
 * is what makes the view count actually look live: the post detail page's `bySlug` fetch is
 * cached for 5 minutes (tagged for the admin-edit revalidation path, not per-view), so simply
 * re-reading it after this mutation would still show the pre-increment number.
 *
 * The `useRef` guard is needed because React 19 Strict Mode (dev only) mounts every component
 * twice; without it a single visit would double-count in local dev.
 */
export function ViewTracker({ id, initialCount }: ViewTrackerProps) {
  const [count, setCount] = useState(initialCount);
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trpcBrowser.posts.incrementViews.mutate({ id }).then(
      (result) => {
        if (typeof result.viewCount === 'number') setCount(result.viewCount);
      },
      () => {
        // best-effort analytics counter -- a failed increment just leaves the stale count shown.
      },
    );
  }, [id]);

  return <span data-testid="view-count">{count}</span>;
}
