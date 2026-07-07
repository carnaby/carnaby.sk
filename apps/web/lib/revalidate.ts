'use server';

import { revalidateTag } from 'next/cache';

import { getServerSession } from './session';

// Next 16's `revalidateTag` requires a second "profile" argument (its Cache
// Components API repurposes the same call for `"use cache"` cache-life
// profiles). We don't use `"use cache"` here -- these tags are only ever
// attached via `fetch`'s `next.tags` option (see `lib/trpc-server.ts`) -- so
// there's no meaningful profile to pass. 'max' is Next's own recommended
// replacement for the deprecated single-argument call; see
// https://nextjs.org/docs/messages/revalidate-tag-single-arg
const FULL_PURGE_PROFILE = 'max';

/**
 * Admin-only Server Action: invalidates the Next Data Cache entries tagged
 * by `tagsFor` (see `lib/trpc-server.ts`) for the given post slugs, plus the
 * shared `posts` and `categories` list tags.
 *
 * Rejects with `Error('forbidden')` for anyone who isn't a signed-in admin,
 * so it is safe to expose directly to client components (Task 18's admin
 * UI) without an additional guard.
 */
export async function revalidateContent(slugs: string[]): Promise<void> {
  const session = await getServerSession();
  if (session?.user.role !== 'admin') {
    throw new Error('forbidden');
  }

  revalidateTag('posts', FULL_PURGE_PROFILE);
  revalidateTag('categories', FULL_PURGE_PROFILE);
  for (const slug of slugs) {
    revalidateTag(`post:${slug}`, FULL_PURGE_PROFILE);
  }
}
