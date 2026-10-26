import { describe, expect, it } from 'vitest';
import {
  descriptionToMarkdown,
  mergeYoutubeTranslations,
  parseIsoDuration,
  summaryFromDescription,
  youtubeTranslations,
} from './youtube';

describe('descriptionToMarkdown', () => {
  it('keeps paragraphs and line breaks, links URLs and escapes markdown syntax', () => {
    const md = descriptionToMarkdown('#carnaby #synthpop\nPrvý riadok\nDruhý *riadok*\n\nSpotify: https://open.spotify.com/track/a_b.\n');
    expect(md).toBe('\\#carnaby \\#synthpop  \nPrvý riadok  \nDruhý \\*riadok\\*\n\nSpotify: <https://open.spotify.com/track/a_b>.');
  });

  it('normalises CRLF and collapses 3+ newlines into one paragraph break', () => {
    expect(descriptionToMarkdown('a\r\n\r\n\r\nb')).toBe('a\n\nb');
  });
});

describe('summaryFromDescription', () => {
  it('skips link-only and hashtag-only paragraphs', () => {
    expect(summaryFromDescription('https://x.sk\n\n#a #b\n\nToto je skutočný popis pesničky.', 200)).toBe('Toto je skutočný popis pesničky.');
  });
  it('truncates on a word boundary', () => {
    const s = summaryFromDescription('slovo '.repeat(60), 50)!;
    expect(s.length).toBeLessThanOrEqual(50);
    expect(s.endsWith('slovo…')).toBe(true);
  });
  it('returns undefined when there is nothing usable', () => {
    expect(summaryFromDescription('', 100)).toBeUndefined();
  });
});

describe('youtubeTranslations + mergeYoutubeTranslations', () => {
  const sk = { title: 'Pieseň', description: 'Popis piesne, dosť dlhý na teaser.' };
  const en = { title: 'Song', description: 'Song description, long enough for a teaser.' };

  it('uses the single text for both languages of a fresh post', () => {
    const merged = mergeYoutubeTranslations(youtubeTranslations('abc', sk, null), {});
    expect(merged.sk.title).toBe('Pieseň');
    expect(merged.en.title).toBe('Pieseň');
  });

  it('maps YouTube localizations to their languages', () => {
    const yt = youtubeTranslations('abc', sk, 'sk', { 'en-US': en });
    const merged = mergeYoutubeTranslations(yt, {});
    expect(merged.sk.title).toBe('Pieseň');
    expect(merged.en.title).toBe('Song');
  });

  it('never overwrites an existing translation with text in another language', () => {
    const existingEn = { title: 'Translated on the web', content: 'x' };
    const merged = mergeYoutubeTranslations(youtubeTranslations('abc', sk, 'sk'), { en: existingEn });
    expect(merged.sk.title).toBe('Pieseň');
    expect(merged.en).toBe(existingEn);
  });

  it('treats an unsupported video language as neither sk nor en', () => {
    const yt = youtubeTranslations('abc', sk, 'cs');
    expect(yt.byLanguage).toEqual({});
    expect(mergeYoutubeTranslations(yt, { sk: { title: 'Keep', content: 'x' } }).sk.title).toBe('Keep');
  });

  it('gives an empty description a link body so the translation stays valid', () => {
    expect(youtubeTranslations('abc', { title: 'T', description: '' }, 'sk').fallback.content).toBe('<https://youtu.be/abc>');
  });
});

describe('parseIsoDuration', () => {
  it.each([['PT3M25S', 205], ['PT1H', 3600], ['PT45S', 45], ['P1DT1S', 86401], ['P0D', 0], ['bogus', 0]])('%s → %i', (v, s) => {
    expect(parseIsoDuration(v)).toBe(s);
  });
});
