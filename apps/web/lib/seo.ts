import type { Metadata } from 'next';

import { DEFAULT_LANGUAGE, LANGUAGES, type Language } from '@carnaby/shared';

import { getPathname } from '../i18n/navigation';
import { APP_URL } from './site-url';

/** Absolute public URL of `path` in `locale` (`/x` for sk, `/en/x` for en). */
export function localizedUrl(path: string, locale: Language): string {
  return `${APP_URL}${getPathname({ href: path, locale })}`;
}

/**
 * `canonical` + `hreflang` alternates for a page that exists in `available` languages.
 *
 * Without an explicit canonical Google picks one itself and reports the rest as "Duplicate
 * without user-selected canonical" -- notably `/en/posts/x` of an SK-only post, which renders the
 * SK fallback content. Such a page canonicalises to the language that is actually rendered, and
 * only languages that really exist are advertised as alternates.
 */
export function pageAlternates(
  path: string,
  locale: Language,
  available: readonly Language[] = LANGUAGES,
): NonNullable<Metadata['alternates']> {
  const languages = available.length > 0 ? available : LANGUAGES;
  const rendered = languages.includes(locale) ? locale : (languages[0] ?? DEFAULT_LANGUAGE);
  const xDefault = languages.includes(DEFAULT_LANGUAGE) ? DEFAULT_LANGUAGE : rendered;
  return {
    canonical: localizedUrl(path, rendered),
    languages: {
      ...Object.fromEntries(languages.map((language) => [language, localizedUrl(path, language)])),
      'x-default': localizedUrl(path, xDefault),
    },
  };
}
