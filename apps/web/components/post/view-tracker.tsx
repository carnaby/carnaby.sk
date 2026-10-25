'use client';

import { useEffect, useRef, useState } from 'react';

import { trpcBrowser } from '../../lib/trpc-browser';

export interface ViewTrackerProps {
  id: number;
  /** Server-rendered view count to show until the increment below resolves. */
  initialCount: number;
}

/**
 * Fires `posts.incrementViews` once per page visit and renders the resulting count in place
 * (the server-rendered number was read before this visit was counted).
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
