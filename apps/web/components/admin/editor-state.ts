import { postUpsertInput, slugify, type Language, type PostUpsertInput } from '@carnaby/shared';

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
    translations: { sk: emptyTranslation(), en: emptyTranslation() },
  };
}

/** A language tab counts as "present" once both title and content are non-blank — matches
 * `postUpsertInput`'s own translation shape (title/content both `min(1)`) and is what
 * `buildUpsertInput` uses to decide whether to drop a tab. */
export function isTranslationPresent(t: TranslationFormState): boolean {
  return t.title.trim() !== '' && t.content.trim() !== '';
}

/**
 * Updates a single field of a single language's translation. Editing the `title` field
 * auto-regenerates the shared `slug` (via `slugify`) as long as the slug hasn't been hand-edited
 * yet (`!state.slugTouched`) — the brief's "slug auto-slugify from first non-empty title until
 * manually edited".
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
  const slug = field === 'title' && !state.slugTouched ? slugify(value) : state.slug;
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

/**
 * Shapes the free-form `EditorState` into the api's `postUpsertInput` contract and validates it.
 * A language tab that isn't `isTranslationPresent` is dropped entirely — not sent as an
 * empty/partial translation — and `postUpsertInput`'s own `.refine` then enforces that at least
 * one of sk/en survived. Blank optional fields (excerpt, metaDescription, youtubeId,
 * soundcloudUrl, thumbnailPath) are sent as `undefined`, never as `""`.
 */
export function buildUpsertInput(state: EditorState): BuildUpsertResult {
  const translations: NonNullable<PostUpsertInput['translations']> = {};
  for (const language of ['sk', 'en'] satisfies Language[]) {
    const t = state.translations[language];
    if (!isTranslationPresent(t)) continue;
    translations[language] = {
      title: t.title.trim(),
      content: t.content,
      excerpt: t.excerpt.trim() || undefined,
      metaDescription: t.metaDescription.trim() || undefined,
    };
  }

  const candidate = {
    slug: state.slug,
    status: state.status,
    isFeatured: state.isFeatured,
    youtubeId: state.youtubeId.trim() || undefined,
    soundcloudUrl: state.soundcloudUrl.trim() || undefined,
    thumbnailPath: state.thumbnailPath.trim() || undefined,
    categoryIds: state.categoryIds,
    translations,
  };

  const result = postUpsertInput.safeParse(candidate);
  if (!result.success) {
    return { errors: result.error.issues.map((issue) => issue.message) };
  }
  return { input: result.data };
}
