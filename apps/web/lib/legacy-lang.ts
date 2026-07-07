// v1 served both languages from the same path via a `?language=` query param
// (see git show carnaby-sk-origin:views/partials/header.ejs, `switchLanguage`).
// v2 encodes the locale in the URL itself (sk unprefixed, en under `/en/...`).
// Old links/bookmarks/search-engine results carrying `?language=` must keep
// working, so this helper maps them onto the new URL scheme. It is a pure
// function so it can be unit-tested without spinning up middleware/Next.

const EN_PREFIX = '/en';

/**
 * Given a request URL, returns the URL it should 307-redirect to when a
 * legacy `?language=` param is present, or `null` when there is nothing to
 * do (no `language` param — let next-intl's own middleware handle routing).
 *
 * The `language` param is always stripped when present. When it disagrees
 * with the current locale encoded in the path, the path is rewritten to the
 * matching locale (`en` -> add `/en` prefix, `sk` -> remove it). All other
 * query params are preserved.
 */
export function legacyLanguageRedirect(url: URL): URL | null {
  const language = url.searchParams.get('language');
  if (language === null) {
    return null;
  }

  const next = new URL(url);
  next.searchParams.delete('language');

  const hasEnPrefix = next.pathname === EN_PREFIX || next.pathname.startsWith(`${EN_PREFIX}/`);

  if (language === 'en' && !hasEnPrefix) {
    next.pathname = next.pathname === '/' ? EN_PREFIX : `${EN_PREFIX}${next.pathname}`;
  } else if (language === 'sk' && hasEnPrefix) {
    const stripped = next.pathname.slice(EN_PREFIX.length);
    next.pathname = stripped === '' ? '/' : stripped;
  }

  return next;
}
