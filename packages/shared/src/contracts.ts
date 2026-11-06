import { z } from 'zod';

export const languageSchema = z.enum(['sk', 'en']);
export const postStatusSchema = z.enum(['draft', 'published', 'archived']);

export const translationInput = z.object({
  title: z.string().min(1),
  excerpt: z.string().optional(),
  content: z.string().min(1),
  metaDescription: z.string().optional(),
});

/** True for absolute http(s) URLs -- the only schemes a link on the site may use (no javascript:, data:, ...). */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** An absolute http(s) URL, trimmed, at most 2048 characters. Messages are Slovak: the admin editor shows them. */
export const httpUrl = z
  .string()
  .trim()
  .max(2048, 'Odkaz je príliš dlhý (najviac 2048 znakov).')
  .refine(isHttpUrl, 'Odkaz musí byť adresa http:// alebo https://.');

export const postUpsertInput = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  status: postStatusSchema,
  isFeatured: z.boolean(),
  youtubeId: z.string().optional(),
  soundcloudUrl: z.string().url().optional(),
  /** Link to the project's own site (devlog posts); renders the "Open project" button. */
  projectUrl: httpUrl.optional(),
  thumbnailPath: z.string().optional(),
  categoryIds: z.array(z.number().int()),
  /** Overrides the publish date (e.g. the YouTube release date). Omitted = keep the stored one,
   * or "now" when a post is first published. */
  publishedAt: z.string().datetime({ offset: true }).optional(),
  translations: z
    .object({ sk: translationInput.optional(), en: translationInput.optional() })
    .refine((t) => t.sk || t.en, { message: 'At least one translation required' }),
});

export type PostUpsertInput = z.infer<typeof postUpsertInput>;
export type TranslationInput = z.infer<typeof translationInput>;

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
