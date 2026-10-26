import { DEFAULT_LANGUAGE, LANGUAGES, type Language } from './i18n';
import type { TranslationInput } from './contracts';

/** Title + description of a YouTube video in one language. */
export interface YoutubeText {
  title: string;
  description: string;
}

/** Post translations derived from a YouTube video: `byLanguage` holds only the languages the
 * video really has text in (its own language + YouTube "localizations"); `fallback` is the
 * video's default text, used for languages the post doesn't have yet. */
export interface YoutubeTranslations {
  byLanguage: Partial<Record<Language, TranslationInput>>;
  fallback: TranslationInput;
}

const MARKDOWN_SPECIAL = /([\\`*_[\]<>#|~])/g;
const URL_PATTERN = /(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g;

function escapeMarkdown(text: string): string {
  return text.replace(MARKDOWN_SPECIAL, '\\$1');
}

/**
 * Converts a plain-text YouTube description to markdown that renders the way it reads on
 * YouTube: blank lines separate paragraphs, single newlines stay line breaks, URLs become links,
 * and markdown syntax in the text (a leading "#hashtag" would otherwise turn into a heading) is
 * escaped.
 */
export function descriptionToMarkdown(description: string): string {
  return description
    .replace(/\r\n?/g, '\n')
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) =>
      paragraph
        .split('\n')
        .map((line) =>
          line
            .split(URL_PATTERN)
            .map((part, i) => (i % 2 === 1 ? `<${part}>` : escapeMarkdown(part)))
            .join('')
            .trimEnd(),
        )
        .join('  \n'),
    )
    .join('\n\n');
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const atWord = cut.slice(0, cut.lastIndexOf(' ') > max * 0.6 ? cut.lastIndexOf(' ') : cut.length);
  return `${atWord.replace(/[\s.,;:!?-]+$/, '')}…`;
}

/** First paragraph of the description that isn't just links or hashtags, as plain text. */
export function summaryFromDescription(description: string, max: number): string | undefined {
  const paragraph = description
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.replace(URL_PATTERN, '').replace(/(^|\s)#[\p{L}\p{N}_]+/gu, ' ').replace(/\s+/g, ' ').trim())
    .find((p) => p.length >= 20);
  return paragraph ? truncate(paragraph, max) : undefined;
}

/** Maps one language's YouTube text onto a post translation. */
export function youtubeTextToTranslation(text: YoutubeText, videoId: string): TranslationInput {
  const content = descriptionToMarkdown(text.description);
  return {
    title: text.title.trim(),
    // The post page embeds the video itself; a video without a description still needs a body.
    content: content || `<https://youtu.be/${videoId}>`,
    excerpt: summaryFromDescription(text.description, 200),
    metaDescription: summaryFromDescription(text.description, 155),
  };
}

/** `sk-SK` → `sk`; null for languages the site doesn't have. */
export function normalizeYoutubeLanguage(code: string | null | undefined): Language | null {
  const base = code?.toLowerCase().split(/[-_]/)[0];
  return LANGUAGES.find((l) => l === base) ?? null;
}

/**
 * Builds post translations from a video's default text and its localizations. The default text
 * counts as the video's own language (`defaultLanguage` in YouTube Studio; the site default when
 * the video doesn't say).
 */
export function youtubeTranslations(
  videoId: string,
  defaultText: YoutubeText,
  defaultLanguage: string | null | undefined,
  localizations: Record<string, YoutubeText> = {},
): YoutubeTranslations {
  const byLanguage: Partial<Record<Language, TranslationInput>> = {};
  const own = normalizeYoutubeLanguage(defaultLanguage) ?? (defaultLanguage ? null : DEFAULT_LANGUAGE);
  if (own) byLanguage[own] = youtubeTextToTranslation(defaultText, videoId);
  for (const [code, text] of Object.entries(localizations)) {
    const language = normalizeYoutubeLanguage(code);
    if (language && text.title?.trim()) byLanguage[language] = youtubeTextToTranslation(text, videoId);
  }
  return { byLanguage, fallback: youtubeTextToTranslation(defaultText, videoId) };
}

/**
 * Applies YouTube texts to a post's translations:
 *  - a language the video has text in is replaced by it;
 *  - a language the post already has (e.g. translated later on the web) is kept;
 *  - a missing language gets the video's default text, so a fresh post is complete in both.
 */
export function mergeYoutubeTranslations(
  youtube: YoutubeTranslations,
  existing: Partial<Record<Language, TranslationInput | null | undefined>>,
): Record<Language, TranslationInput> {
  return Object.fromEntries(
    LANGUAGES.map((language) => [language, youtube.byLanguage[language] ?? existing[language] ?? youtube.fallback]),
  ) as Record<Language, TranslationInput>;
}

/** ISO-8601 duration (`PT1H2M3S`) → seconds. */
export function parseIsoDuration(value: string | null | undefined): number {
  const m = value?.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  const [, d = '0', h = '0', min = '0', s = '0'] = m;
  return Number(d) * 86_400 + Number(h) * 3_600 + Number(min) * 60 + Number(s);
}
