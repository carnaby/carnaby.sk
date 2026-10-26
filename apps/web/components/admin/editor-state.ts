import {
  mergeYoutubeTranslations,
  postUpsertInput,
  slugify,
  type Language,
  type PostUpsertInput,
  type TranslationInput,
  type YoutubeTranslations,
} from '@carnaby/shared';

/**
 * Mirrors the api's `PostStatus` (`apps/api/src/posts/posts.read.ts`) — duplicated as a small,
 * stable literal union rather than imported, same convention as
 * `components/admin/posts-table.tsx`'s own `PostStatus`/`StatusFilter`.
 */
export type PostStatus = 'draft' | 'published' | 'archived';

/** One language tab's editable fields. Always plain strings (never `undefined`) so every field
 * can be a controlled `<Input>`/`<Textarea>` — `buildUpsertInput` is what turns blank strings
 * into the `optional()` fields `postUpsertInput` actually expects. */
export interface TranslationFormState {
  title: string;
  excerpt: string;
  content: string;
  metaDescription: string;
}

export type TranslationField = keyof TranslationFormState;

export interface EditorState {
  slug: string;
  /** Once true, `setTranslationField` never auto-generates the slug again — set by `setSlug`,
   * the moment a human types directly into the slug field. */
  slugTouched: boolean;
  status: PostStatus;
  isFeatured: boolean;
  youtubeId: string;
  soundcloudUrl: string;
  thumbnailPath: string;
  categoryIds: number[];
  /** ISO date-time, '' = not set yet (the api stamps "now" on first publish). */
  publishedAt: string;
  translations: Record<Language, TranslationFormState>;
}

export function emptyTranslation(): TranslationFormState {
  return { title: '', excerpt: '', content: '', metaDescription: '' };
}

/** Fresh state for `<PostEditor mode="new">`. */
export function createEmptyState(): EditorState {
  return {
    slug: '',
    slugTouched: false,
    status: 'draft',
    isFeatured: false,
    youtubeId: '',
    soundcloudUrl: '',
    thumbnailPath: '',
    categoryIds: [],
    publishedAt: '',
    translations: { sk: emptyTranslation(), en: emptyTranslation() },
  };
}

/** A language tab counts as "present" once both title and content are non-blank — matches
 * `postUpsertInput`'s own translation shape (title/content both `min(1)`) and is what
 * `buildUpsertInput` uses to decide whether to drop a tab. */
export function isTranslationPresent(t: TranslationFormState): boolean {
  return t.title.trim() !== '' && t.content.trim() !== '';
}

/** A language tab that has *some* field typed (title, excerpt, content, or meta description) but
 * isn't `isTranslationPresent` yet — e.g. a title with no content, content with no title, or just
 * an excerpt/meta description typed on their own. Distinct from a fully blank tab (nothing typed
 * at all): `buildUpsertInput` silently drops a blank tab (nothing to lose) but must not silently
 * drop a partial one (typed content would otherwise vanish on save without any warning) — see
 * that function's own doc comment. */
export function isTranslationPartial(t: TranslationFormState): boolean {
  const anyFieldFilled =
    t.title.trim() !== '' || t.excerpt.trim() !== '' || t.content.trim() !== '' || t.metaDescription.trim() !== '';
  return anyFieldFilled && !isTranslationPresent(t);
}

/**
 * Updates a single field of a single language's translation. Editing a `title` field
 * auto-regenerates the shared `slug` (via `slugify`) as long as the slug hasn't been hand-edited
 * yet (`!state.slugTouched`). The source is always the SK title (default language, unprefixed
 * URL), falling back to EN only while SK has none -- typing the EN title must not hijack a slug
 * already derived from the SK one.
 */
export function setTranslationField(
  state: EditorState,
  language: Language,
  field: TranslationField,
  value: string,
): EditorState {
  const translations = {
    ...state.translations,
    [language]: { ...state.translations[language], [field]: value },
  };
  const slugSource = translations.sk.title.trim() || translations.en.title.trim();
  const slug = field === 'title' && !state.slugTouched ? slugify(slugSource) : state.slug;
  return { ...state, translations, slug };
}

/** A human edited the slug field directly — from now on `setTranslationField` leaves it alone. */
export function setSlug(state: EditorState, slug: string): EditorState {
  return { ...state, slug, slugTouched: true };
}

/** "Skopírovať z SK/EN": seeds `to`'s fields from `from`'s as a starting point for translating.
 * A plain overwrite — the untranslated tab this is offered on has nothing to lose. */
export function copyTranslation(state: EditorState, from: Language, to: Language): EditorState {
  return {
    ...state,
    translations: { ...state.translations, [to]: { ...state.translations[from] } },
  };
}

export type BuildUpsertResult = { input: PostUpsertInput } | { errors: string[] };

const LANGUAGE_LABEL: Record<Language, string> = { sk: 'SK', en: 'EN' };

/**
 * Shapes the free-form `EditorState` into the api's `postUpsertInput` contract and validates it.
 *
 * A language tab that's fully blank (`isTranslationPresent` false, `isTranslationPartial` false —
 * nothing typed at all) is dropped entirely — not sent as an empty translation — and
 * `postUpsertInput`'s own `.refine` then enforces that at least one of sk/en survived.
 *
 * A tab that's *partially* filled in (`isTranslationPartial` true — e.g. a title with no content)
 * is a different story: silently dropping it would throw away whatever the user typed with no
 * warning. So instead this returns a validation error for every partial tab, blocking the save
 * entirely, before even attempting the zod parse below.
 *
 * Blank optional fields (excerpt, metaDescription, youtubeId, soundcloudUrl, thumbnailPath) on a
 * present tab are sent as `undefined`, never as `""`.
 */
export function buildUpsertInput(state: EditorState): BuildUpsertResult {
  const partialErrors: string[] = [];
  const translations: NonNullable<PostUpsertInput['translations']> = {};
  for (const language of ['sk', 'en'] satisfies Language[]) {
    const t = state.translations[language];
    if (isTranslationPartial(t)) {
      partialErrors.push(
        `Jazyk ${LANGUAGE_LABEL[language]} má rozpísaný obsah — doplň názov aj obsah, alebo polia vymaž.`,
      );
      continue;
    }
    if (!isTranslationPresent(t)) continue;
    translations[language] = {
      title: t.title.trim(),
      content: t.content,
      excerpt: t.excerpt.trim() || undefined,
      metaDescription: t.metaDescription.trim() || undefined,
    };
  }
  if (partialErrors.length > 0) return { errors: partialErrors };

  const candidate = {
    slug: state.slug,
    status: state.status,
    isFeatured: state.isFeatured,
    youtubeId: state.youtubeId.trim() || undefined,
    soundcloudUrl: state.soundcloudUrl.trim() || undefined,
    thumbnailPath: state.thumbnailPath.trim() || undefined,
    categoryIds: state.categoryIds,
    publishedAt: state.publishedAt || undefined,
    translations,
  };

  const result = postUpsertInput.safeParse(candidate);
  if (!result.success) {
    return { errors: result.error.issues.map((issue) => issue.message) };
  }
  return { input: result.data };
}

export interface YoutubePreviewData {
  translations: YoutubeTranslations;
  publishedAt: string;
  thumbnail: string | null;
}

function toFormState(t: TranslationInput): TranslationFormState {
  return { title: t.title, excerpt: t.excerpt ?? '', content: t.content, metaDescription: t.metaDescription ?? '' };
}

/**
 * "Načítať z YouTube": fills the form from the video -- texts per `mergeYoutubeTranslations`
 * (a language YouTube has is replaced, an already written translation YouTube lacks is kept, an
 * empty one gets the video's text), release date, still, and the slug while it is still
 * auto-generated. Nothing is saved until the admin clicks a save button.
 */
export function applyYoutubePreview(state: EditorState, preview: YoutubePreviewData): EditorState {
  const existing = Object.fromEntries(
    (['sk', 'en'] as const).map((language) => {
      const t = state.translations[language];
      return [language, isTranslationPresent(t) ? { title: t.title, content: t.content, excerpt: t.excerpt || undefined, metaDescription: t.metaDescription || undefined } : null];
    }),
  ) as Record<Language, TranslationInput | null>;
  const merged = mergeYoutubeTranslations(preview.translations, existing);
  return {
    ...state,
    slug: state.slugTouched ? state.slug : slugify(merged.sk.title),
    thumbnailPath: preview.thumbnail ?? state.thumbnailPath,
    publishedAt: preview.publishedAt,
    translations: { sk: toFormState(merged.sk), en: toFormState(merged.en) },
  };
}
