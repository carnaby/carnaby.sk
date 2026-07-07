import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Badge } from '../../components/ui/badge';
import { getServerSession } from '../../lib/session';

const QUICK_LINKS = [
  {
    href: '/admin/posts',
    title: 'Príspevky',
    description: 'Písanie, úprava a publikovanie príspevkov.',
  },
  {
    href: '/admin/users',
    title: 'Používatelia',
    description: 'Prehľad prihlásených používateľov a ich rolí.',
  },
];

/** Admin dashboard: welcome card + quick links. Slovak-only (see layout doc). */
export default async function AdminDashboardPage() {
  // The layout's gate is authoritative; this re-check just narrows the type
  // (layout and page render concurrently, so the session isn't passed down).
  const session = await getServerSession();
  if (!session || session.user.role !== 'admin') {
    redirect('/login');
  }

  const { user } = session;

  return (
    <div className="flex flex-col gap-6">
      <section className="glass rounded-glass p-6">
        <h1 className="font-display text-2xl font-semibold text-white">
          Vitajte, {user.name || user.email}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-white/60">
          <span>{user.email}</span>
          <Badge variant="secondary">{user.role}</Badge>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="glass rounded-glass p-6 transition-colors hover:bg-white/5"
          >
            <h2 className="font-display text-lg font-semibold text-white">{link.title}</h2>
            <p className="mt-1 text-sm text-white/60">{link.description}</p>
          </Link>
        ))}
      </section>

      <section className="glass rounded-glass p-6">
        <h2 className="font-display text-lg font-semibold text-white">Návštevnosť</h2>
        <p className="mt-1 text-sm text-white/60">
          Štatistiky návštevnosti bežia na vlastnej inštancii Umami.
        </p>
        <a
          href="https://analytics.carnaby.sk"
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-devlog transition-colors hover:text-white"
        >
          Otvoriť analytics.carnaby.sk ↗
        </a>
      </section>
    </div>
  );
}
