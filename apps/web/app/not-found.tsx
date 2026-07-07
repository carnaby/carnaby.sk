import './globals.css';

/**
 * Root-level fallback, outside any locale. `app/[locale]/layout.tsx` is this app's de-facto root
 * layout (there is no separate `app/layout.tsx` -- see its own doc comment) and calls `notFound()`
 * itself when the `[locale]` segment doesn't match `sk`/`en` (e.g. a stray `/fr/...` request).
 * Because that call happens in the *layout*, Next can't reuse `[locale]/not-found.tsx` for it (that
 * file is only reachable through the layout that just failed) and walks up to this file instead.
 * Kept locale-agnostic (plain English, no `next-intl`) since there's no valid locale to translate
 * into at this point.
 */
export default function RootNotFound() {
  return (
    <html lang="en">
      <body className="site-bg flex min-h-dvh items-center justify-center bg-base text-white antialiased">
        <div className="mx-auto max-w-xl px-4 py-24 text-center">
          <h1 className="font-display text-3xl font-bold">Page not found</h1>
          <p className="mt-4 text-white/70">The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
          <a
            href="/"
            className="glass mt-8 inline-flex rounded-glass px-5 py-2.5 text-sm font-medium text-white/80 transition-colors hover:text-white"
          >
            Back to homepage
          </a>
        </div>
      </body>
    </html>
  );
}
