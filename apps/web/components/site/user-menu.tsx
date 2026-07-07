'use client';

import { useEffect, useRef, useState } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Link } from '../../i18n/navigation';
import { authClient } from '../../lib/auth-client';

/**
 * Header auth slot. Signed out → localized "Sign in" link (locale-aware, so
 * `/en` visitors land on `/en/login`). Signed in → avatar button opening a
 * small hand-rolled glass popover (menu is two items — a headless
 * useState/click-outside popover keeps the public bundle free of the
 * dropdown-menu primitive). The "Admin panel" link is a plain `next/link`
 * because `/admin` lives outside the `[locale]` tree and must never get an
 * `/en` prefix.
 */
export function UserMenu() {
  const t = useTranslations('userMenu');
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (isPending) {
    // Reserve the avatar's footprint so the header doesn't shift once the
    // session resolves.
    return <span aria-hidden className="inline-block size-8" />;
  }

  if (!session) {
    return (
      <Link
        href="/login"
        className="text-sm font-medium text-white/80 transition-colors hover:text-white"
      >
        {t('signIn')}
      </Link>
    );
  }

  const { user } = session;
  const initial = (user.name || user.email).charAt(0).toUpperCase();

  async function handleSignOut() {
    await authClient.signOut();
    setOpen(false);
    // Re-render server components so anything session-derived (e.g. a future
    // personalized header) drops back to the anonymous state immediately.
    router.refresh();
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('openMenu')}
        onClick={() => setOpen((value) => !value)}
        className="flex size-8 items-center justify-center overflow-hidden rounded-full border border-line bg-surface text-sm font-medium text-white transition-colors hover:border-white/25"
      >
        {user.image ? (
          /* Plain <img>: the avatar is a 32px thumbnail from Google's CDN —
             not worth a next/image remotePatterns entry + optimization pass.
             no-referrer avoids Google's hotlink 403s. */
          <img src={user.image} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
        ) : (
          initial
        )}
      </button>

      {open ? (
        <div role="menu" className="glass-strong absolute right-0 top-10 z-50 w-56 rounded-glass p-2">
          <div className="border-b border-line px-3 pb-2 pt-1">
            <p className="truncate text-sm font-medium text-white">{user.name}</p>
            <p className="truncate text-xs text-white/60">{user.email}</p>
          </div>
          <div className="mt-1 flex flex-col">
            {user.role === 'admin' ? (
              <NextLink
                href="/admin"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-left text-sm text-white/80 transition-colors hover:bg-white/5 hover:text-white"
              >
                {t('adminPanel')}
              </NextLink>
            ) : null}
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="rounded-lg px-3 py-2 text-left text-sm text-white/80 transition-colors hover:bg-white/5 hover:text-white"
            >
              {t('signOut')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
