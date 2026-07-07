import { describe, expect, it } from 'vitest';

import { legacyLanguageRedirect } from './legacy-lang';

describe('legacyLanguageRedirect', () => {
  it('redirects / with ?language=en to /en', () => {
    const result = legacyLanguageRedirect(new URL('http://localhost:3000/?language=en'));
    expect(result?.pathname).toBe('/en');
    expect(result?.searchParams.has('language')).toBe(false);
  });

  it('redirects /posts/x?language=en to /en/posts/x', () => {
    const result = legacyLanguageRedirect(new URL('http://localhost:3000/posts/x?language=en'));
    expect(result?.pathname).toBe('/en/posts/x');
    expect(result?.searchParams.has('language')).toBe(false);
  });

  it('redirects /en/posts/x?language=sk to /posts/x', () => {
    const result = legacyLanguageRedirect(new URL('http://localhost:3000/en/posts/x?language=sk'));
    expect(result?.pathname).toBe('/posts/x');
    expect(result?.searchParams.has('language')).toBe(false);
  });

  it('returns null when there is no language param', () => {
    const result = legacyLanguageRedirect(new URL('http://localhost:3000/posts/x?foo=bar'));
    expect(result).toBeNull();
  });

  it('preserves other query params while stripping language', () => {
    const result = legacyLanguageRedirect(new URL('http://localhost:3000/posts/x?foo=bar&language=en'));
    expect(result?.pathname).toBe('/en/posts/x');
    expect(result?.searchParams.get('foo')).toBe('bar');
    expect(result?.searchParams.has('language')).toBe(false);
  });

  it('is a no-op redirect (strip only) when locale already matches en prefix', () => {
    const result = legacyLanguageRedirect(new URL('http://localhost:3000/en/posts/x?language=en'));
    expect(result?.pathname).toBe('/en/posts/x');
    expect(result?.searchParams.has('language')).toBe(false);
  });

  it('is a no-op redirect (strip only) when already sk (no prefix) and language=sk', () => {
    const result = legacyLanguageRedirect(new URL('http://localhost:3000/posts/x?language=sk'));
    expect(result?.pathname).toBe('/posts/x');
    expect(result?.searchParams.has('language')).toBe(false);
  });
});
