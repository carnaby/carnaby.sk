import type { Db } from '@carnaby/db';
import { LANGUAGES, postUpsertInput, type PostUpsertInput } from '@carnaby/shared';
import { getPostById, upsertPost, type PostById } from './posts.admin';

/** A post candidate that fails the `postUpsertInput` contract; the message lists every issue. */
export class InvalidPostError extends Error {}

/** Final validation through the same contract the admin UI uses, with readable messages. */
export function validateUpsert(candidate: unknown): PostUpsertInput {
  const parsed = postUpsertInput.safeParse(candidate);
  if (!parsed.success) {
    throw new InvalidPostError(`Invalid post: ${parsed.error.issues.map((i) => `${i.path.join('.') || 'post'}: ${i.message}`).join('; ')}`);
  }
  return parsed.data;
}

/** The stored post in `postUpsertInput` shape -- the base every partial change is applied to. */
export function currentAsInput(current: PostById): PostUpsertInput {
  const translations: PostUpsertInput['translations'] = {};
  for (const lang of LANGUAGES) {
    const t = current.translations[lang];
    if (t) translations[lang] = t;
  }
  return {
    slug: current.post.slug,
    status: current.post.status,
    isFeatured: current.post.isFeatured,
    youtubeId: current.post.youtubeId ?? undefined,
    soundcloudUrl: current.post.soundcloudUrl ?? undefined,
    projectUrl: current.post.projectUrl ?? undefined,
    thumbnailPath: current.post.thumbnailPath ?? undefined,
    categoryIds: current.categoryIds,
    translations,
  };
}

/** Applies `changes` on top of the stored post, validates the result and saves it. */
export async function savePostChanges(db: Db, id: number, changes: Partial<PostUpsertInput>, authorId: string | null): Promise<void> {
  const current = await getPostById(db, id);
  const input = validateUpsert({ ...currentAsInput(current), ...changes });
  await upsertPost(db, { ...input, id }, authorId);
}
