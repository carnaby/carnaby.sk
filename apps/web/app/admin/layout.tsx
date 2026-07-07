import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { fontVars } from '../../lib/fonts';
import { getServerSession } from '../../lib/session';
import { TRPCProvider } from '../../lib/trpc-react';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Administrácia — carnaby.sk',
  robots: { index: false, follow: false },
};

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/posts', label: 'Príspevky' },
  { href: '/admin/users', label: 'Používatelia' },
];

/**
 * Admin root layout. `/admin` lives OUTSIDE the `[locale]` tree on purpose:
 * the admin area is Slovak-only (matching v1), so it renders its own
 * `<html lang="sk">` shell instead of nesting under the locale layout — the
 * middleware matcher already excludes `/admin` from next-intl routing.
 * Deliberately NOT mounted here: `<Umami/>` (analytics must not count admin
 * traffic) and `MotionProvider` (no motion animations in the admin shell).
 *
 * The gate runs server-side on every admin request: anonymous visitors go to
 * `/login`, signed-in non-admins to the homepage. Pages under /admin can
 * therefore assume an admin session, though the redirect here is what's
 * authoritative — a page's own `getServerSession()` re-check is belt and
 * braces, not the gate.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }
  if (session.user.role !== 'admin') {
    redirect('/');
  }

  return (
    <html lang="sk" className={fontVars}>
      <body className="site-bg min-h-dvh antialiased">
        <div className="mx-auto flex min-h-dvh w-full max-w-6xl gap-6 px-4 py-6">
          <aside className="glass sticky top-6 flex h-fit w-52 shrink-0 flex-col rounded-glass p-3">
            <Link
              href="/admin"
              className="px-3 pb-3 pt-1 font-display text-lg font-semibold tracking-tight text-white"
            >
              carnaby.sk
            </Link>
            <nav className="flex flex-col gap-1" aria-label="Administrácia">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/"
                className="mt-2 rounded-lg border-t border-line px-3 pb-2 pt-3 text-sm font-medium text-white/50 transition-colors hover:text-white"
              >
                → Web
              </Link>
            </nav>
          </aside>
          <main className="min-w-0 flex-1">
            <TRPCProvider>{children}</TRPCProvider>
          </main>
        </div>
      </body>
    </html>
  );
}
