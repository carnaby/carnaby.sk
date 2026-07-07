import { describe, expect, it } from 'vitest';
import { pickTranslation } from './posts.read';

describe('pickTranslation', () => {
  it('returns the requested language when present', () => {
    const sk = { language: 'sk' as const, v: 1 };
    const en = { language: 'en' as const, v: 2 };
    expect(pickTranslation([sk, en], 'en')).toBe(en);
  });

  it('falls back to the other language when the requested one is missing', () => {
    const en = { language: 'en' as const, v: 2 };
    expect(pickTranslation([en], 'sk')).toBe(en);
  });

  it('returns undefined when no translation exists in either language', () => {
    expect(pickTranslation([], 'sk')).toBeUndefined();
  });
});
