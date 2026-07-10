import type { Metadata } from 'next';

import { UsersTable } from '../../../components/admin/users-table';

export const metadata: Metadata = {
  title: 'Používatelia — Administrácia',
};

/**
 * `/admin/users`: read-only table of all users with avatar, name, email, role, and created date.
 * The admin layout's server-side gate (`app/admin/layout.tsx`) already guarantees an admin
 * session by the time this renders, so this stays a thin server component wrapping the
 * client-side table (`components/admin/users-table.tsx`), which owns all the tRPC/react-query
 * fetching and loading/error/empty states.
 */
export default function AdminUsersPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-white">Používatelia</h1>
        <p className="mt-1 text-sm text-white/60">
          Zoznam všetkých registrovaných používateľov.
        </p>
      </div>
      <UsersTable />
    </div>
  );
}
