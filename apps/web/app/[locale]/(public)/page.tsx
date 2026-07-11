import { getTranslations } from 'next-intl/server';

import type { Language } from '@carnaby/shared';

import { PostCard } from '../../../components/post/post-card';
import { About } from '../../../components/site/about';
import { Hero } from '../../../components/site/hero';
import { serverTrpc } from '../../../lib/trpc-server';

const FEATURED_LIMIT = 6;

// This page fetches live data from the api (`posts.list`), which isn't reachable during
// `next build`'s static-generation pass (CI's build step doesn't run the api, only Postgres —
// see .github/workflows/ci.yml) or a cold local build. Opting out of build-time prerendering
// means it's rendered per-request instead; the underlying `serverTrpc(['posts'])` fetch still
// participates in Next's Data Cache (5 min revalidate, tag-invalidated by
// `lib/revalidate.ts`), so this doesn't turn into an uncached hit on every request.
export const dynamic = 'force-dynamic';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const language = locale as Language;
  const t = await getTranslations('home');

  // Tagged ['posts'] so an admin publish/edit (lib/revalidate.ts's revalidateContent) can bust
  // this cached list without a redeploy.
  const { items: featured } = await serverTrpc(['posts']).posts.list.query({
    featured: true,
    limit: FEATURED_LIMIT,
    language,
  });

  return (
    <>
      <Hero />
      <About />

      <p className="mx-auto max-w-xl px-4 text-center text-sm text-white/50">{t('heroSubtitle')}</p>

      <div className="mx-auto mt-6 flex max-w-5xl items-center gap-4 px-4 text-xs font-semibold uppercase tracking-widest text-white/40">
        <span className="h-px flex-1 bg-line" />
        <span>{t('feedLabel')}</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <section className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="font-display text-2xl font-semibold text-white sm:text-3xl">
          {t('featuredTitle')}
        </h2>
        <div data-testid="featured-grid" className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      </section>
    </>
  );
}
