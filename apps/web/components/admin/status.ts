export type PostStatus = 'draft' | 'published' | 'archived';

export const STATUS_LABEL: Record<PostStatus, string> = {
  draft: 'Koncept',
  published: 'Publikované',
  archived: 'Archivované',
};

/** Literal classes (Tailwind must see them verbatim). */
export const STATUS_BADGE_CLASS: Record<PostStatus, string> = {
  draft: 'border-dodo/30 bg-dodo/15 text-dodo',
  published: 'border-devlog/30 bg-devlog/15 text-devlog',
  archived: 'border-white/20 bg-white/10 text-white/60',
};

export const STATUS_DOT_CLASS: Record<PostStatus, string> = {
  draft: 'bg-dodo',
  published: 'bg-devlog',
  archived: 'bg-white/40',
};

export const DATE_FORMATTER = new Intl.DateTimeFormat('sk', { dateStyle: 'medium' });
