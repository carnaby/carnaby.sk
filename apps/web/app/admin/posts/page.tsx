import type { Metadata } from 'next';
import { Suspense } from 'react';

import { PostsTable } from '../../../components/admin/posts-table';

export const metadata: Metadata = {
  title: 'Príspevky — Administrácia',
};

/** `/admin/posts`. Suspense: the list reads its filters from the URL (`useSearchParams`). */
export default function AdminPostsPage() {
  return (
    <Suspense>
      <PostsTable />
    </Suspense>
  );
}
