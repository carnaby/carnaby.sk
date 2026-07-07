import { Guitar, Music2, Terminal } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { CATEGORIES, type CategorySlug, type Language } from '@carnaby/shared';

import { PostCard } from '../../../../../components/post/post-card';
import { Link, permanentRedirect } from '../../../../../i18n/navigation';
import { serverTrpc } from '../../../../../lib/trpc-server';

const ICONS = { terminal: Terminal, guitar: Guitar, 'music-2': Music2 } as const;
const PAGE_LIMIT = 9;

// v1 used the slug `dev` for what v2 calls `devlog` — old links/bookmarks/search-engine
// results must keep resolving, permanently, to the renamed category (see
// `docs/superpowers/specs/2026-07-06-carnaby-v2-rewrite-design.md`).
const LEGACY_SLUG_REDIRECTS: Record<string, CategorySlug> = { dev: 'devlog' };

function resolveCategory(slug: string) {
  return Object.prototype.hasOwnProperty.call(CATEGORIES, slug) ? CATEGORIES[slug as CategorySlug] : undefined;
}

type CategoryPageParams = { locale: string; slug: string };

// Same rationale as the homepage (`app/[locale]/(public)/page.tsx`): `posts.list` is a live api
// call that isn't reachable during `next build`'s static-generation pass, so this page is
// rendered per-request rather than prerendered.
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<CategoryPageParams>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const category = resolveCategory(slug);
  if (!category) return {};

  const language = locale as Language;
  return {
    title: `${category.name[language]} — carnaby.sk`,
    description: category.description[language],
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<CategoryPageParams>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale, slug } = await params;
  const { page: pageParam } = await searchParams;

  const redirectSlug = LEGACY_SLUG_REDIRECTS[slug];
  if (redirectSlug) {
    permanentRedirect({ href: `/category/${redirectSlug}`, locale });
  }

  const category = resolveCategory(slug);
  if (!category) {
    notFound();
  }

  const language = locale as Language;
  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1);
  const t = await getTranslations('category');
  const Icon = ICONS[category.icon];

  // Tagged ['posts'] so an admin publish/edit (lib/revalidate.ts's revalidateContent) can bust
  // this cached list without a redeploy — same convention as the homepage's featured query.
  const { items, pageCount } = await serverTrpc(['posts']).posts.list.query({
    category: category.slug,
    language,
    page,
    limit: PAGE_LIMIT,
  });

  return (
    <>
      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <span
          className="mx-auto mb-6 inline-flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: `${category.color}1a`, color: category.color }}
        >
          <Icon size={28} aria-hidden="true" />
        </span>
        <h1
          className="font-display text-3xl font-bold tracking-tight sm:text-4xl"
          style={{ color: category.color }}
        >
          {category.name[language]}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-balance text-white/70">
          {category.description[language]}
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16">
        {items.length === 0 ? (
          <p data-testid="category-empty" className="py-12 text-center text-white/60">
            {t('empty')}
          </p>
        ) : (
          <div data-testid="category-grid" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}

        {pageCount > 1 ? (
          <nav className="mt-10 flex items-center justify-center gap-4" aria-label="Pagination">
            {page > 1 ? (
              <Link
                href={`/category/${category.slug}?page=${page - 1}`}
                className="glass rounded-glass px-5 py-2.5 text-sm font-medium text-white/80 transition-colors hover:text-white"
              >
                {t('newer')}
              </Link>
            ) : null}
            {page < pageCount ? (
              <Link
                href={`/category/${category.slug}?page=${page + 1}`}
                className="glass rounded-glass px-5 py-2.5 text-sm font-medium text-white/80 transition-colors hover:text-white"
              >
                {t('older')}
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>
    </>
  );
}
