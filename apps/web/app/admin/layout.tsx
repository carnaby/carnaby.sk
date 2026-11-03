import type { Metadata, Viewport } from 'next';
import { redirect } from 'next/navigation';

import { AdminMain, AdminSidebar, AdminTabBar, AdminTopBar } from '../../components/admin/admin-nav';
import { Toaster } from '../../components/ui/sonner';
import { fontVars } from '../../lib/fonts';
import { getServerSession } from '../../lib/session';
import { TRPCProvider } from '../../lib/trpc-react';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Administrácia — carnaby.sk',
  robots: { index: false, follow: false },
};

// viewport-fit=cover + env(safe-area-inset-*) keep the bottom bars clear of the iPhone home bar.
export const viewport: Viewport = {
  themeColor: '#030303',
  viewportFit: 'cover',
};

/**
 * Admin root layout. `/admin` lives OUTSIDE the `[locale]` tree on purpose: the admin area is
 * Slovak-only, so it renders its own `<html lang="sk">` shell (the middleware matcher already
 * excludes `/admin` from next-intl routing). No Umami (admin traffic must not be counted).
 *
 * Responsive shell: sidebar on lg+, top bar + bottom tab bar below (the post editor swaps the
 * tab bar for its own action bar). The session gate runs server-side on every admin request:
 * anonymous visitors go to `/login`, signed-in non-admins to the homepage.
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
        <div className="flex min-h-dvh">
          <AdminSidebar userName={session.user.name || session.user.email} />
          <div className="flex min-w-0 flex-1 flex-col">
            <AdminTopBar />
            <AdminMain>
              <TRPCProvider>{children}</TRPCProvider>
            </AdminMain>
          </div>
        </div>
        <AdminTabBar />
        <Toaster theme="dark" position="top-center" />
      </body>
    </html>
  );
}
