import type { MetadataRoute } from 'next';

import { CATEGORIES, LANGUAGES, type Language } from '@carnaby/shared';

import { localizedUrl } from '../lib/seo';
import { serverTrpc } from '../lib/trpc-server';

const PAGE_LIMIT = 50;

// Rendered per request so newly published posts show up immediately. Must be explicit: the
// try/catch below would otherwise swallow the signal Next uses to detect dynamic rendering at
// build time and freeze the sitemap to its static entries.
export const dynamic = 'force-dynamic';

/** One entry per existing language version, each listing all versions as hreflang alternates. */
function entries(path: string, languages: readonly Language[], lastModified?: string): MetadataRoute.Sitemap {
  const alternates = { languages: Object.fromEntries(languages.map((l) => [l, localizedUrl(path, l)])) };
  return languages.map((language) => ({
    url: localizedUrl(path, language),
    ...(lastModified ? { lastModified } : {}),
    alternates,
  }));
}

/**
 * Published posts with the languages each one really has. `posts.list` falls back to the other
 * language when the requested one is missing (and reports which one it rendered), so a post is
 * in language X only when the list for X returns it *in* X. Listing `/en/posts/x` for an SK-only
 * post would hand Google a duplicate of the SK page.
 */
async function publishedPosts(): Promise<Map<string, { languages: Language[]; publishedAt: string | null }>> {
  const posts = new Map<string, { languages: Language[]; publishedAt: string | null }>();
  for (const language of LANGUAGES) {
    for (let page = 1; ; page += 1) {
      const { items, pageCount } = await serverTrpc().posts.list.query({ language, page, limit: PAGE_LIMIT });
      for (const item of items) {
        const entry = posts.get(item.slug) ?? { languages: [], publishedAt: item.publishedAt };
        if (item.language === language) entry.languages.push(language);
        posts.set(item.slug, entry);
      }
      if (page >= pageCount) break;
    }
  }
  return posts;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    ...entries('/', LANGUAGES),
    ...Object.values(CATEGORIES).flatMap((category) => entries(`/category/${category.slug}`, LANGUAGES)),
  ];

  try {
    const posts = await publishedPosts();
    return [
      ...staticEntries,
      ...[...posts].flatMap(([slug, { languages, publishedAt }]) =>
        entries(`/posts/${slug}`, languages, publishedAt ?? undefined),
      ),
    ];
  } catch {
    // api unreachable (e.g. restarting) -- ship the static entries rather than a 500.
    return staticEntries;
  }
}
