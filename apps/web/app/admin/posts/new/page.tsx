import type { Metadata } from 'next';

import { PostEditor } from '../../../../components/admin/post-editor';

export const metadata: Metadata = {
  title: 'Nový príspevok — Administrácia',
};

/**
 * `/admin/posts/new`: thin wrapper around `<PostEditor mode="new">`, which owns all the
 * form state, tRPC calls, and save actions (Task 21).
 */
export default function NewPostPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-white">Nový príspevok</h1>
        <p className="mt-1 text-sm text-white/60">Vytvorte koncept a publikujte, keď bude pripravený.</p>
      </div>
      <PostEditor mode="new" />
    </div>
  );
}
