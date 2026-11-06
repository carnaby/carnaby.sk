import { describe, expect, it } from 'vitest';
import { findShareImage } from './og-image';

const PAGE = 'https://one-light-day.carnaby.sk/about/';

describe('findShareImage', () => {
  it('reads og:image (the real One Light-Day head)', () => {
    const html = '<head><meta property="og:image" content="https://one-light-day.carnaby.sk/og.png"><meta property="og:image:width" content="1200"></head>';
    expect(findShareImage(html, PAGE)).toBe('https://one-light-day.carnaby.sk/og.png');
  });

  it('prefers og:image over twitter:image regardless of document order', () => {
    const html = '<meta name="twitter:image" content="/tw.png"><meta property="og:image" content="/og.png">';
    expect(findShareImage(html, PAGE)).toBe('https://one-light-day.carnaby.sk/og.png');
  });

  it('falls back through secure_url and twitter:image', () => {
    expect(findShareImage('<meta property="og:image:secure_url" content="https://a.sk/s.png">', PAGE)).toBe('https://a.sk/s.png');
    expect(findShareImage('<meta name="twitter:image:src" content="https://a.sk/t.png">', PAGE)).toBe('https://a.sk/t.png');
  });

  it('handles attribute order, single quotes, unquoted values and case', () => {
    expect(findShareImage("<META CONTENT='/a.png' PROPERTY='OG:IMAGE' />", PAGE)).toBe('https://one-light-day.carnaby.sk/a.png');
    expect(findShareImage('<meta content=https://a.sk/b.png property=og:image>', PAGE)).toBe('https://a.sk/b.png');
  });

  it('resolves relative urls against the page and decodes entities', () => {
    expect(findShareImage('<meta property="og:image" content="img/x.png?a=1&amp;b=2">', PAGE)).toBe(
      'https://one-light-day.carnaby.sk/about/img/x.png?a=1&b=2',
    );
    expect(findShareImage('<meta property="og:image" content="&#x2F;y.png">', PAGE)).toBe('https://one-light-day.carnaby.sk/y.png');
  });

  it('copes with ">" inside an attribute value', () => {
    expect(findShareImage('<meta data-x="a > b" property="og:image" content="/z.png">', PAGE)).toBe('https://one-light-day.carnaby.sk/z.png');
  });

  it('skips non-http values and empty content, then returns null when nothing is left', () => {
    expect(findShareImage('<meta property="og:image" content="javascript:alert(1)"><meta name="twitter:image" content="/t.png">', PAGE)).toBe(
      'https://one-light-day.carnaby.sk/t.png',
    );
    expect(findShareImage('<meta property="og:image" content="  ">', PAGE)).toBeNull();
    expect(findShareImage('<title>No image</title>', PAGE)).toBeNull();
  });

  it('stays linear on hostile unterminated markup', () => {
    for (const html of ['<meta '.repeat(200_000), '<meta content="'.repeat(70_000)]) {
      const started = performance.now();
      expect(findShareImage(html, PAGE)).toBeNull();
      expect(performance.now() - started).toBeLessThan(500);
    }
  });

  it('keeps tags parsed before an unterminated <meta', () => {
    expect(
      findShareImage('<meta property="og:image" content="https://a.sk/ok.png"><meta data-x="never closed', PAGE),
    ).toBe('https://a.sk/ok.png');
    expect(findShareImage('<meta name="twitter:image" content="/tw.png"><meta data-x="open', PAGE)).toBe(
      'https://one-light-day.carnaby.sk/tw.png',
    );
  });

  it('uses the first duplicate og:image tag', () => {
    expect(
      findShareImage('<meta property="og:image" content="/first.png"><meta property="og:image" content="/second.png">', PAGE),
    ).toBe('https://one-light-day.carnaby.sk/first.png');
  });
});
