'use client';

import { Calendar } from 'lucide-react';
import { motion } from 'motion/react';
import { useLocale } from 'next-intl';

import { CATEGORIES, type CategorySlug, type Language } from '@carnaby/shared';

import { Link } from '../../i18n/navigation';
import { cn } from '../../lib/cn';
import type { PostListItem } from '../../lib/trpc-server';
import { PostImage } from './post-image';

// Tailwind needs literal class names to detect them at build time — same pattern as
// `site/header.tsx`'s `NAV_HOVER_CLASS`.
const CHIP_CLASS: Record<CategorySlug, string> = {
  devlog: 'border-devlog/30 bg-devlog/15 text-devlog',
  dodo: 'border-dodo/30 bg-dodo/15 text-dodo',
  carnaby: 'border-carnaby/30 bg-carnaby/15 text-carnaby',
};

export interface PostCardProps {
  post: PostListItem;
  /** 'grid' (default): vertical card, image on top — used by the homepage's featured grid.
   * 'row': horizontal card, content left / thumbnail right — used by category page lists
   * (v1-style layout). */
  variant?: 'grid' | 'row';
}

/** Glass card for a post list/grid: image, colored category chips, title, excerpt, date.
 * Hovering lifts the card and blooms a glow in its primary category's color. View counts are
 * intentionally not shown here (only on the post detail page) — see `variant`'s doc comment for
 * where each layout is used. */
export function PostCard({ post, variant = 'grid' }: PostCardProps) {
  const locale = useLocale() as Language;
  const primarySlug = post.categories[0]?.slug as CategorySlug | undefined;
  const accent = primarySlug ? CATEGORIES[primarySlug]?.color : undefined;
  const publishedLabel = post.publishedAt
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(post.publishedAt))
    : null;

  const chips = post.categories.map((category) => (
    <span
      key={category.slug}
      className={cn(
        'rounded-full border px-2.5 py-0.5 text-xs font-medium',
        variant === 'row' && 'uppercase tracking-wide',
        CHIP_CLASS[category.slug as CategorySlug],
      )}
    >
      {category.name}
    </span>
  ));

  const dateLabel = publishedLabel ? (
    <span className="flex items-center gap-1.5">
      <Calendar size={14} aria-hidden="true" />
      {publishedLabel}
    </span>
  ) : null;

  const motionProps = {
    initial: { boxShadow: '0 0 0 0 transparent' },
    whileHover: {
      y: -4,
      boxShadow: accent ? `0 20px 60px -16px ${accent}80` : '0 20px 40px -16px rgb(0 0 0 / 0.4)',
    },
    transition: { type: 'spring', stiffness: 300, damping: 24 } as const,
  };

  if (variant === 'row') {
    return (
      <article>
        <Link href={`/posts/${post.slug}`} className="group block">
          <motion.div {...motionProps} className="glass flex flex-col gap-5 rounded-glass p-5 sm:flex-row sm:items-center">
            <div className="flex flex-1 flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                {chips}
                {publishedLabel ? <span className="text-xs text-white/50">{publishedLabel}</span> : null}
              </div>
              <h3 className="font-display text-xl font-semibold text-white">{post.title}</h3>
              {post.excerpt ? <p className="line-clamp-2 text-sm text-white/70">{post.excerpt}</p> : null}
            </div>
            <div className="aspect-[3/2] w-full shrink-0 overflow-hidden rounded-lg bg-surface sm:w-[200px]">
              <PostImage
                post={post}
                width={300}
                className="transition-transform duration-500 group-hover:scale-105"
              />
            </div>
          </motion.div>
        </Link>
      </article>
    );
  }

  return (
    <article className="h-full">
      <Link href={`/posts/${post.slug}`} className="group block h-full">
        <motion.div {...motionProps} className="glass flex h-full flex-col overflow-hidden rounded-glass">
          <div className="aspect-video shrink-0 overflow-hidden bg-surface">
            <PostImage
              post={post}
              width={600}
              className="transition-transform duration-500 group-hover:scale-105"
            />
          </div>
          <div className="flex flex-1 flex-col gap-3 p-5">
            <div className="flex flex-wrap gap-2">{chips}</div>
            <h3 className="font-display text-lg font-semibold text-white">{post.title}</h3>
            {post.excerpt ? <p className="line-clamp-2 text-sm text-white/70">{post.excerpt}</p> : null}
            {dateLabel ? <div className="mt-auto flex items-center gap-4 pt-2 text-xs text-white/50">{dateLabel}</div> : null}
          </div>
        </motion.div>
      </Link>
    </article>
  );
}
