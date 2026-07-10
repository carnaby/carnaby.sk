import { describe, expect, it } from 'vitest';

import {
  buildUpsertInput,
  copyTranslation,
  createEmptyState,
  isTranslationPresent,
  setSlug,
  setTranslationField,
  type EditorState,
} from '../components/admin/editor-state';

/** A state with only the SK tab filled in — the common "create draft" starting point every test
 * below builds on. */
function skOnlyState(): EditorState {
  let state = createEmptyState();
  state = setTranslationField(state, 'sk', 'title', 'Ahoj svet');
  state = setTranslationField(state, 'sk', 'content', 'Obsah príspevku.');
  return state;
}

describe('buildUpsertInput', () => {
  it('drops the empty EN tab entirely, keeping only SK', () => {
    const result = buildUpsertInput(skOnlyState());

    expect('input' in result).toBe(true);
    if (!('input' in result)) throw new Error('expected input');
    expect(result.input.translations.en).toBeUndefined();
    expect(result.input.translations.sk).toEqual({
      title: 'Ahoj svet',
      content: 'Obsah príspevku.',
      excerpt: undefined,
      metaDescription: undefined,
    });
  });

  it('drops a tab with only a title and no content (still not "present")', () => {
    let state = skOnlyState();
    state = setTranslationField(state, 'en', 'title', 'Hello world');
    // no EN content set

    const result = buildUpsertInput(state);
    expect('input' in result).toBe(true);
    if (!('input' in result)) throw new Error('expected input');
    expect(result.input.translations.en).toBeUndefined();
  });

  it('returns errors when no language is present', () => {
    const state = createEmptyState();

    const result = buildUpsertInput(state);
    expect('errors' in result).toBe(true);
    if (!('errors' in result)) throw new Error('expected errors');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.join(' ')).toMatch(/translation/i);
  });

  it('rejects a slug with invalid characters even when a translation is present', () => {
    let state = skOnlyState();
    state = setSlug(state, 'Not A Valid Slug!');

    const result = buildUpsertInput(state);
    expect('errors' in result).toBe(true);
  });

  it('keeps both tabs when both are present', () => {
    let state = skOnlyState();
    state = setTranslationField(state, 'en', 'title', 'Hello world');
    state = setTranslationField(state, 'en', 'content', 'Post content.');

    const result = buildUpsertInput(state);
    expect('input' in result).toBe(true);
    if (!('input' in result)) throw new Error('expected input');
    expect(result.input.translations.sk).toBeDefined();
    expect(result.input.translations.en).toBeDefined();
  });

  it('carries the requested status/categories/shared fields through', () => {
    let state = skOnlyState();
    state = { ...state, status: 'published', isFeatured: true, categoryIds: [1, 2], youtubeId: 'abc123' };

    const result = buildUpsertInput(state);
    expect('input' in result).toBe(true);
    if (!('input' in result)) throw new Error('expected input');
    expect(result.input.status).toBe('published');
    expect(result.input.isFeatured).toBe(true);
    expect(result.input.categoryIds).toEqual([1, 2]);
    expect(result.input.youtubeId).toBe('abc123');
  });

  it('sends blank optional fields as undefined, not empty strings', () => {
    let state = skOnlyState();
    state = { ...state, youtubeId: '   ', soundcloudUrl: '', thumbnailPath: '' };

    const result = buildUpsertInput(state);
    expect('input' in result).toBe(true);
    if (!('input' in result)) throw new Error('expected input');
    expect(result.input.youtubeId).toBeUndefined();
    expect(result.input.soundcloudUrl).toBeUndefined();
    expect(result.input.thumbnailPath).toBeUndefined();
  });
});

describe('setTranslationField (slug auto-generation)', () => {
  it('auto-slugifies from the title while the slug is untouched', () => {
    let state = createEmptyState();
    state = setTranslationField(state, 'sk', 'title', 'Ahoj Svet');
    expect(state.slug).toBe('ahoj-svet');
    expect(state.slugTouched).toBe(false);

    state = setTranslationField(state, 'sk', 'title', 'Ahoj Svet Znova');
    expect(state.slug).toBe('ahoj-svet-znova');
  });

  it('stops auto-updating the slug once it has been manually edited', () => {
    let state = createEmptyState();
    state = setTranslationField(state, 'sk', 'title', 'Ahoj Svet');
    state = setSlug(state, 'moj-vlastny-slug');
    expect(state.slugTouched).toBe(true);

    state = setTranslationField(state, 'sk', 'title', 'Uplne Iny Titulok');
    expect(state.slug).toBe('moj-vlastny-slug');
  });

  it('does not touch the slug when editing a non-title field', () => {
    let state = createEmptyState();
    state = setTranslationField(state, 'sk', 'title', 'Ahoj Svet');
    state = setTranslationField(state, 'sk', 'excerpt', 'Krátky popis');
    expect(state.slug).toBe('ahoj-svet');
  });

  it('is per-field: editing EN title does not clobber SK title', () => {
    let state = skOnlyState();
    state = setTranslationField(state, 'en', 'title', 'Hello world');
    expect(state.translations.sk.title).toBe('Ahoj svet');
    expect(state.translations.en.title).toBe('Hello world');
  });
});

describe('isTranslationPresent', () => {
  it('is false for a blank translation', () => {
    expect(isTranslationPresent({ title: '', excerpt: '', content: '', metaDescription: '' })).toBe(false);
  });

  it('is false when only whitespace is present', () => {
    expect(isTranslationPresent({ title: '   ', excerpt: '', content: '\n', metaDescription: '' })).toBe(false);
  });

  it('is true once both title and content are non-blank', () => {
    expect(isTranslationPresent({ title: 'T', excerpt: '', content: 'C', metaDescription: '' })).toBe(true);
  });
});

describe('copyTranslation', () => {
  it('seeds the target language from the source, leaving the source untouched', () => {
    const state = skOnlyState();
    const copied = copyTranslation(state, 'sk', 'en');

    expect(copied.translations.en).toEqual(copied.translations.sk);
    expect(copied.translations.sk).toEqual(state.translations.sk);
  });
});
