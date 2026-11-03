import { redirect } from 'next/navigation';

import { Dashboard } from '../../components/admin/dashboard';
import { getServerSession } from '../../lib/session';

/** Admin dashboard. The layout's gate is authoritative; this re-check only narrows the type. */
export default async function AdminDashboardPage() {
  const session = await getServerSession();
  if (!session || session.user.role !== 'admin') {
    redirect('/login');
  }
  return <Dashboard name={session.user.name || session.user.email} />;
}
