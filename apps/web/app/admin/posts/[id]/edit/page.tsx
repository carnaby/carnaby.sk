import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PostEditor } from '../../../../../components/admin/post-editor';

export const metadata: Metadata = {
  title: 'Upraviť príspevok — Administrácia',
};

type EditPostPageParams = { id: string };

/**
 * `/admin/posts/[id]/edit`: thin wrapper around `<PostEditor mode={{ id }}>`, which loads
 * `posts.byId` and owns all the form state, tRPC calls, and save actions (Task 21).
 *
 * A non-numeric `id` param 404s here; a numeric id that just doesn't exist in the db is instead
 * handled inside `<PostEditor>` itself (its `posts.byId` query's error state), since that's a
 * live-data condition rather than a malformed-URL one.
 */
export default async function EditPostPage({ params }: { params: Promise<EditPostPageParams> }) {
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId)) {
    notFound();
  }

  return <PostEditor mode={{ id: postId }} />;
}
