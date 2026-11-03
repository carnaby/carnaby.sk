import type { Metadata } from 'next';

import { PostEditor } from '../../../../components/admin/post-editor';

export const metadata: Metadata = {
  title: 'Nový príspevok — Administrácia',
};

export default function NewPostPage() {
  return <PostEditor mode="new" />;
}
