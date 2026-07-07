import { Calendar, Eye } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { isTRPCClientError } from '@trpc/client';

import { LANGUAGES, type CategorySlug, type Language } from '@carnaby/shared';

import { PostBody } from '../../../../../components/post/markdown';
import { PostImage } from '../../../../../components/post/post-image';
import { ViewTracker } from '../../../../../components/post/view-tracker';
import { YoutubeEmbed } from '../../../../../components/post/youtube-embed';
import { Link, getPathname } from '../../../../../i18n/navigation';
import { thumbUrl, youtubeThumbUrl } from '../../../../../lib/images';
import { APP_URL } from '../../../../../lib/site-url';
import { serverTrpc, tagsFor, type PostListItem } from '../../../../../lib/trpc-server';

// Same duplication as `app/[locale]/(public)/category/[slug]/page.tsx` and
// `components/post/post-card.tsx` -- Tailwind needs literal class names to detect them at build
// time, so this small lookup lives next to each place that renders a category chip rather than
// being imported from one of them.
const CHIP_CLASS: Record<CategorySlug, string> = {
  devlog: 'border-devlog/30 bg-devlog/15 text-devlog',
  dodo: 'border-dodo/30 bg-dodo/15 text-dodo',
  carnaby: 'border-carnaby/30 bg-carnaby/15 text-carnaby',
};

type PostPageParams = { locale: string; slug: string };

// `posts.bySlug` is a live api call, unreachable during `next build`'s static-generation pass --
// same rationale as the homepage/category pages.
export const dynamic = 'force-dynamic';

/** Fetches the post, translating the api's `NOT_FOUND` into `null` so callers can 404 rather
 * than crash. Shared by `generateMetadata` and the page component -- Next dedupes identical
 * `fetch` calls made during the same request, so this doesn't double the network cost. */
async function loadPost(slug: string, language: Language) {
  try {
    return await serverTrpc(tagsFor(slug)).posts.bySlug.query({ slug, language });
  } catch (err) {
    if (isTRPCClientError(err) && err.data?.code === 'NOT_FOUND') return null;
    throw err;
  }
}

function absoluteImageUrl(post: Pick<PostListItem, 'thumbnailPath' | 'youtubeId'>): string | undefined {
  if (post.thumbnailPath) return `${APP_URL}${thumbUrl(post.thumbnailPath, 1200)}`;
  if (post.youtubeId) return youtubeThumbUrl(post.youtubeId);
  return undefined;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PostPageParams>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await loadPost(slug, locale as Language);
  if (!post) return {};

  const description = post.metaDescription ?? post.excerpt ?? undefined;
  const image = absoluteImageUrl(post);

  return {
    title: `${post.title} — carnaby.sk`,
    description,
    alternates: {
      languages: Object.fromEntries(
        LANGUAGES.map((language) => [language, `${APP_URL}${getPathname({ href: `/posts/${slug}`, locale: language })}`]),
      ),
    },
    openGraph: {
      title: post.title,
      description,
      type: 'article',
      images: image ? [{ url: image }] : undefined,
    },
  };
}

export default async function PostPage({ params }: { params: Promise<PostPageParams> }) {
  const { locale, slug } = await params;
  const language = locale as Language;
  const post = await loadPost(slug, language);
  if (!post) {
    notFound();
  }

  const t = await getTranslations('post');
  const publishedLabel = post.publishedAt
    ? new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(new Date(post.publishedAt))
    : null;
  const primaryCategory = post.categories[0];

  return (
    <article className="mx-auto max-w-[800px] px-4 py-12">
      <header className="mb-8">
        {post.categories.length > 0 ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {post.categories.map((category) => (
              <span
                key={category.slug}
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${CHIP_CLASS[category.slug as CategorySlug] ?? ''}`}
              >
                {category.name}
              </span>
            ))}
          </div>
        ) : null}

        <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {post.title}
        </h1>

        <div className="mt-4 flex items-center gap-4 text-sm text-white/50">
          {publishedLabel ? (
            <span className="flex items-center gap-1.5">
              <Calendar size={14} aria-hidden="true" />
              {publishedLabel}
            </span>
          ) : null}
          <span className="flex items-center gap-1.5" aria-label={t('viewsAria', { count: post.viewCount })}>
            <Eye size={14} aria-hidden="true" />
            <ViewTracker id={post.id} initialCount={post.viewCount} />
          </span>
        </div>

        {post.language !== language ? (
          <p data-testid="language-fallback-note" className="glass mt-4 rounded-glass px-4 py-2.5 text-sm text-white/70">
            {t('fallbackNote', { lang: post.language.toUpperCase() })}
          </p>
        ) : null}
      </header>

      <div className="mb-8">
        {post.youtubeId ? (
          <YoutubeEmbed youtubeId={post.youtubeId} title={post.title} />
        ) : (
          <div className="aspect-video overflow-hidden rounded-glass bg-surface">
            <PostImage post={post} width={1200} />
          </div>
        )}
      </div>

      <PostBody markdown={post.content} />

      {post.soundcloudUrl ? (
        <a
          href={post.soundcloudUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="glass mt-8 inline-flex items-center gap-2 rounded-glass px-5 py-2.5 text-sm font-medium text-white/80 transition-colors hover:text-white"
        >
          {t('soundcloudCta')}
        </a>
      ) : null}

      {primaryCategory ? (
        <footer className="mt-12 border-t border-line pt-8">
          <Link
            href={`/category/${primaryCategory.slug}`}
            className="glass inline-flex rounded-glass px-5 py-2.5 text-sm font-medium text-white/80 transition-colors hover:text-white"
          >
            {t('backToCategory', { category: primaryCategory.name })}
          </Link>
        </footer>
      ) : null}
    </article>
  );
}
