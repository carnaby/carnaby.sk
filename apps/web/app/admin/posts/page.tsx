import type { Metadata } from 'next';

import { PostsTable } from '../../../components/admin/posts-table';

export const metadata: Metadata = {
  title: 'Príspevky — Administrácia',
};

/**
 * `/admin/posts`: filterable/sortable/paginated table of every post (any status), with a delete
 * flow. The admin layout's server-side gate (`app/admin/layout.tsx`) already guarantees an admin
 * session by the time this renders, so this stays a thin server component wrapping the
 * client-side table (`components/admin/posts-table.tsx`), which owns all the tRPC/react-query
 * fetching plus filter/sort/page state and the delete-confirm dialog.
 */
export default function AdminPostsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-white">Príspevky</h1>
        <p className="mt-1 text-sm text-white/60">
          Správa všetkých príspevkov — koncepty, publikované aj archivované.
        </p>
      </div>
      <PostsTable />
    </div>
  );
}
