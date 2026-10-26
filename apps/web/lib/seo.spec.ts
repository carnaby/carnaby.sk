import { describe, expect, it, vi } from 'vitest';

// next-intl's navigation needs the Next runtime; mirror its `localePrefix: 'as-needed'` output.
vi.mock('../i18n/navigation', () => ({
  getPathname: ({ href, locale }: { href: string; locale: string }) =>
    locale === 'sk' ? href : href === '/' ? '/en' : `/en${href}`,
}));

import { pageAlternates } from './seo';
import { APP_URL } from './site-url';

describe('pageAlternates', () => {
  it('canonicalises each language to itself when both exist', () => {
    expect(pageAlternates('/posts/x', 'en')).toEqual({
      canonical: `${APP_URL}/en/posts/x`,
      languages: { sk: `${APP_URL}/posts/x`, en: `${APP_URL}/en/posts/x`, 'x-default': `${APP_URL}/posts/x` },
    });
  });

  it('points the EN URL of an SK-only post at the SK page and advertises only SK', () => {
    expect(pageAlternates('/posts/x', 'en', ['sk'])).toEqual({
      canonical: `${APP_URL}/posts/x`,
      languages: { sk: `${APP_URL}/posts/x`, 'x-default': `${APP_URL}/posts/x` },
    });
  });

  it('uses the EN page as x-default for an EN-only post', () => {
    expect(pageAlternates('/posts/x', 'sk', ['en'])).toMatchObject({
      canonical: `${APP_URL}/en/posts/x`,
      languages: { en: `${APP_URL}/en/posts/x`, 'x-default': `${APP_URL}/en/posts/x` },
    });
  });
});
