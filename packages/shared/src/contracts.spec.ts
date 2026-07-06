import { describe, expect, it } from 'vitest';
import { postUpsertInput, slugify } from './index';

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
