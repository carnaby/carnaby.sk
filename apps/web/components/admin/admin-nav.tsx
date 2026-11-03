'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CirclePlay, ExternalLink, FileText, LayoutDashboard, Users, type LucideIcon } from 'lucide-react';

import { cn } from '../../lib/cn';

interface NavItem {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: 'Prehľad', short: 'Prehľad', icon: LayoutDashboard },
  { href: '/admin/posts', label: 'Príspevky', short: 'Príspevky', icon: FileText },
  { href: '/admin/youtube', label: 'YouTube', short: 'YouTube', icon: CirclePlay },
  { href: '/admin/users', label: 'Používatelia', short: 'Ľudia', icon: Users },
];

function isActive(pathname: string, href: string): boolean {
  return href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`);
}

/** The post editor is a focus screen on mobile: its own sticky action bar replaces the tab bar. */
export function isEditorPath(pathname: string): boolean {
  return pathname === '/admin/posts/new' || /^\/admin\/posts\/\d+\/edit$/.test(pathname);
}

/** Desktop (lg+) sidebar. */
export function AdminSidebar({ userName }: { userName: string }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line px-3 py-5 lg:flex">
      <Link href="/admin" className="px-3 pb-6 font-display text-lg font-semibold tracking-tight text-white">
        carnaby<span className="text-carnaby">.</span>sk
        <span className="ml-2 rounded-md bg-white/10 px-1.5 py-0.5 align-middle text-[10px] font-medium uppercase tracking-wider text-white/60">
          admin
        </span>
      </Link>
      <nav className="flex flex-col gap-1" aria-label="Administrácia">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white',
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-1 border-t border-line pt-4">
        <Link href="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/50 transition-colors hover:text-white">
          <ExternalLink className="size-4" aria-hidden="true" />
          Otvoriť web
        </Link>
        <p className="truncate px-3 text-xs text-white/30">{userName}</p>
      </div>
    </aside>
  );
}

/** Mobile top bar: brand + link to the site. */
export function AdminTopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-page/80 px-4 backdrop-blur-xl lg:hidden">
      <Link href="/admin" className="font-display text-base font-semibold tracking-tight text-white">
        carnaby<span className="text-carnaby">.</span>sk <span className="text-xs font-medium text-white/40">admin</span>
      </Link>
      <Link href="/" className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-white/60 hover:text-white">
        Web <ExternalLink className="size-3.5" aria-hidden="true" />
      </Link>
    </header>
  );
}

/** Mobile bottom tab bar (thumb reach), hidden on editor screens. */
export function AdminTabBar() {
  const pathname = usePathname();
  if (isEditorPath(pathname)) return null;
  return (
    <nav
      aria-label="Administrácia"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-page/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {NAV_ITEMS.map(({ href, short, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  active ? 'text-white' : 'text-white/45',
                )}
              >
                <Icon className={cn('size-5', active && 'text-carnaby')} aria-hidden="true" />
                {short}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Bottom padding for the page content so the tab bar never covers it. */
export function AdminMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <main
      className={cn(
        'mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 pt-5 sm:px-6 lg:px-10 lg:pb-10 lg:pt-8',
        isEditorPath(pathname) ? 'pb-28' : 'pb-[calc(5rem+env(safe-area-inset-bottom))]',
      )}
    >
      {children}
    </main>
  );
}
