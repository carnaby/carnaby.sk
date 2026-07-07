import type { MetadataRoute } from 'next';

import { CATEGORIES } from '@carnaby/shared';

import { APP_URL } from '../lib/site-url';
import { serverTrpc } from '../lib/trpc-server';

const PAGE_LIMIT = 50;
const EN_PREFIX = '/en';

function localizedUrls(path: string): MetadataRoute.Sitemap {
  return [{ url: `${APP_URL}${path}` }, { url: `${APP_URL}${EN_PREFIX}${path}` }];
}

/** All published post slugs, paged through `posts.list` (max `limit` is 50 -- see
 * `apps/api/src/posts/routers.ts`). Slugs are shared across languages (a post's translations
 * don't get their own slug), so a single default-language pass is enough to enumerate them. */
async function allPublishedSlugs(): Promise<string[]> {
  const slugs: string[] = [];
  let page = 1;
  for (;;) {
    const { items, pageCount } = await serverTrpc(['posts']).posts.list.query({ page, limit: PAGE_LIMIT });
    slugs.push(...items.map((item) => item.slug));
    if (page >= pageCount) break;
    page += 1;
  }
  return slugs;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: APP_URL },
    { url: `${APP_URL}${EN_PREFIX}` },
    ...Object.values(CATEGORIES).flatMap((category) => localizedUrls(`/category/${category.slug}`)),
  ];

  try {
    const slugs = await allPublishedSlugs();
    return [...staticEntries, ...slugs.flatMap((slug) => localizedUrls(`/posts/${slug}`))];
  } catch {
    // The api isn't reachable during `next build`'s static-generation pass (or a cold local
    // build) -- ship the static entries rather than failing the build. In production the api is
    // up, and this route revalidates every 5 minutes (`serverTrpc`'s fetch cache), so the full
    // post list shows up shortly after the next successful fetch.
    return staticEntries;
  }
}
