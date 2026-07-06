import { z } from 'zod';

export const languageSchema = z.enum(['sk', 'en']);
export const postStatusSchema = z.enum(['draft', 'published', 'archived']);

export const translationInput = z.object({
  title: z.string().min(1),
  excerpt: z.string().optional(),
  content: z.string().min(1),
  metaDescription: z.string().optional(),
});

export const postUpsertInput = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  status: postStatusSchema,
  isFeatured: z.boolean(),
  youtubeId: z.string().optional(),
  soundcloudUrl: z.string().url().optional(),
  thumbnailPath: z.string().optional(),
  categoryIds: z.array(z.number().int()),
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
