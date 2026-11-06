import { describe, expect, it } from 'vitest';
import { httpUrl, isHttpUrl, postUpsertInput, slugify } from './index';

describe('postUpsertInput', () => {
  it('rejects a post with no translations', () => {
    const r = postUpsertInput.safeParse({
      slug: 'ok', status: 'draft', isFeatured: false, categoryIds: [], translations: {},
    });
    expect(r.success).toBe(false);
  });
  it('accepts a post with one translation', () => {
    const r = postUpsertInput.safeParse({
      slug: 'my-post', status: 'published', isFeatured: true, categoryIds: [1],
      translations: { sk: { title: 'Ahoj', content: '# md' } },
    });
    expect(r.success).toBe(true);
  });
  it('rejects bad slug', () => {
    expect(postUpsertInput.safeParse({
      slug: 'Bad Slug!', status: 'draft', isFeatured: false, categoryIds: [], translations: { sk: { title: 't', content: 'c' } },
    }).success).toBe(false);
  });
});

describe('slugify', () => {
  it('strips diacritics and spaces', () => {
    expect(slugify('Môj Nový Článok!')).toBe('moj-novy-clanok');
  });
});

const basePost = {
  slug: 'my-post', status: 'draft' as const, isFeatured: false, categoryIds: [],
  translations: { sk: { title: 't', content: 'c' } },
};

describe('projectUrl', () => {
  it('accepts http and https urls and trims them', () => {
    const r = postUpsertInput.safeParse({ ...basePost, projectUrl: '  https://one-light-day.carnaby.sk/  ' });
    expect(r.success && r.data.projectUrl).toBe('https://one-light-day.carnaby.sk/');
    expect(postUpsertInput.safeParse({ ...basePost, projectUrl: 'http://example.com' }).success).toBe(true);
  });
  it('is optional', () => {
    expect(postUpsertInput.safeParse(basePost).success).toBe(true);
  });
  it.each(['javascript:alert(1)', 'data:text/html,x', 'ftp://example.com/', 'example.com', ''])('rejects %s', (value) => {
    expect(postUpsertInput.safeParse({ ...basePost, projectUrl: value }).success).toBe(false);
  });
  it('rejects urls longer than 2048 characters', () => {
    expect(httpUrl.safeParse(`https://example.com/${'a'.repeat(2050)}`).success).toBe(false);
  });
  it('explains the problem in Slovak', () => {
    const r = httpUrl.safeParse('javascript:alert(1)');
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe('Odkaz musí byť adresa http:// alebo https://.');
  });
});

describe('isHttpUrl', () => {
  it('detects http(s) urls', () => {
    expect(isHttpUrl('https://a.sk/x')).toBe(true);
    expect(isHttpUrl('mailto:a@a.sk')).toBe(false);
    expect(isHttpUrl('nope')).toBe(false);
  });
});
