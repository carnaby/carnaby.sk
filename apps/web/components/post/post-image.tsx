import { CATEGORIES, type CategorySlug } from '@carnaby/shared';

import { cn } from '../../lib/cn';
import { thumbUrl, youtubeThumbUrl, type ThumbWidth } from '../../lib/images';
import type { PostListItem } from '../../lib/trpc-server';

const FALLBACK_ACCENT = CATEGORIES.devlog.color;

// Every width the api's `/images/:width/:filename` route caches — see `thumbUrl`'s doc comment.
// `srcSet` always offers all three so the browser can pick based on the rendered slot, not just
// the requested `width`.
const SRCSET_WIDTHS: ThumbWidth[] = [300, 600, 1200];

export interface PostImageProps {
  post: Pick<PostListItem, 'title' | 'thumbnailPath' | 'youtubeId' | 'categories'>;
  width: ThumbWidth;
  className?: string;
}

/** Post thumbnail with a three-tier fallback: uploaded image -> YouTube stock thumbnail -> a
 * category-colored gradient placeholder (no broken `<img>` ever renders). */
export function PostImage({ post, width, className }: PostImageProps) {
  const imgClassName = cn('h-full w-full object-cover', className);

  if (post.thumbnailPath) {
    const { thumbnailPath } = post;
    return (
      <img
        src={thumbUrl(thumbnailPath, width)}
        srcSet={SRCSET_WIDTHS.map((w) => `${thumbUrl(thumbnailPath, w)} ${w}w`).join(', ')}
        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
        alt={post.title}
        loading="lazy"
        className={imgClassName}
      />
    );
  }

  if (post.youtubeId) {
    return (
      <img
        src={youtubeThumbUrl(post.youtubeId)}
        alt={post.title}
        loading="lazy"
        className={imgClassName}
      />
    );
  }

  const accent = CATEGORIES[post.categories[0]?.slug as CategorySlug]?.color ?? FALLBACK_ACCENT;
  return (
    <div
      aria-hidden="true"
      className={cn('h-full w-full', className)}
      style={{ background: `linear-gradient(135deg, ${accent}55, ${accent}0d)` }}
    />
  );
}
