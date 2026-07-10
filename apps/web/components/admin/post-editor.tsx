'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Same type-only, module-boundary-safe pattern as `posts-table.tsx`: `@carnaby/api` resolves to a
// barrel that only re-exports the `AppRouter` type, erased entirely at compile time.
// eslint-disable-next-line @nx/enforce-module-boundaries
import type { AppRouter } from '@carnaby/api';
import type { inferRouterOutputs } from '@trpc/server';

import { revalidateContent } from '../../lib/revalidate';
import { useTRPC } from '../../lib/trpc-react';
import { Button, buttonVariants } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Textarea } from '../ui/textarea';
import { MarkdownPreview } from './markdown-preview';
import { ThumbnailPicker } from './thumbnail-picker';
import {
  buildUpsertInput,
  copyTranslation,
  createEmptyState,
  emptyTranslation,
  isTranslationPresent,
  setSlug,
  setTranslationField,
  type EditorState,
  type PostStatus,
  type TranslationField,
  type TranslationFormState,
} from './editor-state';

type PostByIdResult = inferRouterOutputs<AppRouter>['posts']['byId'];

// Duplicated small literal union, same convention as `posts-table.tsx` -- keeps this file free of
// any runtime import from the api project.
type Language = 'sk' | 'en';

const LANGUAGE_LABEL: Record<Language, string> = { sk: 'SK', en: 'EN' };
const OTHER_LANGUAGE: Record<Language, Language> = { sk: 'en', en: 'sk' };

export type PostEditorMode = 'new' | { id: number };

export interface PostEditorProps {
  mode: PostEditorMode;
}

/** Converts the api's `posts.byId` shape into this component's free-form `EditorState`.
 * `slugTouched: true` -- the brief's edit-mode requirement that the slug never auto-changes once
 * a post already exists, even as its title is edited further. */
function fromPostById(data: PostByIdResult): EditorState {
  const base = createEmptyState();
  const toForm = (t: PostByIdResult['translations']['sk']): TranslationFormState =>
    t
      ? { title: t.title, excerpt: t.excerpt ?? '', content: t.content, metaDescription: t.metaDescription ?? '' }
      : emptyTranslation();

  return {
    ...base,
    slug: data.post.slug,
    slugTouched: true,
    status: data.post.status,
    isFeatured: data.post.isFeatured,
    youtubeId: data.post.youtubeId ?? '',
    soundcloudUrl: data.post.soundcloudUrl ?? '',
    thumbnailPath: data.post.thumbnailPath ?? '',
    categoryIds: data.categoryIds,
    translations: { sk: toForm(data.translations.sk), en: toForm(data.translations.en) },
  };
}

/**
 * The heart of the admin (Task 21): bilingual markdown post editor with a live preview.
 *
 * `mode="new"` starts from a blank `EditorState`; `mode={{ id }}` loads `posts.byId` and hydrates
 * from it. Two columns: the form (SK/EN tabs + shared fields) on the left, a sticky live preview
 * of the ACTIVE tab's markdown on the right.
 *
 * All state lives in one `EditorState` (`components/admin/editor-state.ts`) manipulated through
 * that module's pure helpers -- this component's own job is just wiring those helpers to inputs
 * and to the two save mutations.
 */
export function PostEditor({ mode }: PostEditorProps) {
  const router = useRouter();
  const trpc = useTRPC();
  const isEdit = mode !== 'new';
  const id = isEdit ? mode.id : undefined;

  const categoriesQuery = useQuery(trpc.categories.list.queryOptions());
  const postQuery = useQuery({
    ...trpc.posts.byId.queryOptions({ id: id ?? -1 }),
    enabled: isEdit,
  });

  // `manualState` is `null` until the first edit; until then, `state` is derived straight from
  // the loaded post (edit mode) or a blank slate (new mode) -- no `useEffect`/hydration-race
  // needed to keep the form in sync with an async query.
  const [manualState, setManualState] = useState<EditorState | null>(null);
  const state: EditorState = manualState ?? (isEdit && postQuery.data ? fromPostById(postQuery.data) : createEmptyState());

  const [activeLanguage, setActiveLanguage] = useState<Language>('sk');
  const [errors, setErrors] = useState<string[]>([]);
  const [pendingStatus, setPendingStatus] = useState<PostStatus | null>(null);

  function updateState(updater: (prev: EditorState) => EditorState) {
    setManualState(updater(state));
  }

  const createMutation = useMutation(trpc.posts.create.mutationOptions());
  const updateMutation = useMutation(trpc.posts.update.mutationOptions());
  const saving = createMutation.isPending || updateMutation.isPending;

  function handleSave(status: PostStatus) {
    const result = buildUpsertInput({ ...state, status });
    if ('errors' in result) {
      setErrors(result.errors);
      toast.error('Formulár obsahuje chyby, skontrolujte ich nižšie.');
      return;
    }
    setErrors([]);
    setPendingStatus(status);
    const { input } = result;

    const onSuccess = async () => {
      toast.success(isEdit ? 'Príspevok bol uložený.' : 'Príspevok bol vytvorený.');
      try {
        await revalidateContent([input.slug]);
      } catch {
        toast.warning('Príspevok bol uložený, ale obnovenie cache webu sa nepodarilo.');
      }
      router.push('/admin/posts');
    };
    const onError = (error: unknown) => {
      setPendingStatus(null);
      toast.error(error instanceof Error ? error.message : 'Uloženie príspevku sa nepodarilo.');
    };

    if (mode === 'new') {
      createMutation.mutate(input, { onSuccess, onError });
    } else {
      updateMutation.mutate({ id: mode.id, ...input }, { onSuccess, onError });
    }
  }

  if (isEdit && postQuery.isLoading) {
    return (
      <div className="glass flex items-center justify-center gap-2 rounded-glass p-10 text-white/50">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Načítavam príspevok…
      </div>
    );
  }

  if (isEdit && postQuery.isError) {
    return (
      <div className="glass flex flex-col items-center gap-3 rounded-glass p-10 text-white/60">
        <span>Nepodarilo sa načítať príspevok.</span>
        <Button variant="outline" size="sm" onClick={() => postQuery.refetch()}>
          Skúsiť znova
        </Button>
      </div>
    );
  }

  function updateField(language: Language, field: TranslationField, value: string) {
    updateState((prev) => setTranslationField(prev, language, field, value));
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex flex-col gap-6">
        {errors.length > 0 ? (
          <div role="alert" className="glass rounded-glass border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <p className="mb-1 font-medium">Formulár obsahuje chyby:</p>
            <ul className="list-disc pl-5">
              {errors.map((message, index) => (
                <li key={index}>{message}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="glass rounded-glass p-4 sm:p-6">
          <Tabs
            value={activeLanguage}
            onValueChange={(value) => {
              if (value === 'sk' || value === 'en') setActiveLanguage(value);
            }}
          >
            <TabsList>
              <TabsTrigger value="sk">{LANGUAGE_LABEL.sk}</TabsTrigger>
              <TabsTrigger value="en">{LANGUAGE_LABEL.en}</TabsTrigger>
            </TabsList>

            {(['sk', 'en'] as const).map((language) => {
              const translation = state.translations[language];
              const other = OTHER_LANGUAGE[language];
              const present = isTranslationPresent(translation);
              const otherPresent = isTranslationPresent(state.translations[other]);

              return (
                <TabsContent key={language} value={language} className="mt-4 flex flex-col gap-4">
                  {!present ? (
                    <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-glass px-4 py-3 text-sm text-white/60">
                      <span>Táto jazyková verzia ešte nie je preložená.</span>
                      {otherPresent ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => updateState((prev) => copyTranslation(prev, other, language))}
                        >
                          Skopírovať z {LANGUAGE_LABEL[other]}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`title-${language}`}>Titulok</Label>
                    <Input
                      id={`title-${language}`}
                      value={translation.title}
                      onChange={(event) => updateField(language, 'title', event.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`excerpt-${language}`}>Krátky popis</Label>
                    <Textarea
                      id={`excerpt-${language}`}
                      className="min-h-16"
                      value={translation.excerpt}
                      onChange={(event) => updateField(language, 'excerpt', event.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`content-${language}`}>Obsah (Markdown)</Label>
                    <Textarea
                      id={`content-${language}`}
                      className="min-h-[400px] font-mono text-sm"
                      value={translation.content}
                      onChange={(event) => updateField(language, 'content', event.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`meta-${language}`}>Meta popis (SEO)</Label>
                    <Input
                      id={`meta-${language}`}
                      value={translation.metaDescription}
                      onChange={(event) => updateField(language, 'metaDescription', event.target.value)}
                    />
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </div>

        <div className="glass flex flex-col gap-5 rounded-glass p-4 sm:p-6">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="slug">Slug</Label>
            <Input id="slug" value={state.slug} onChange={(event) => updateState((prev) => setSlug(prev, event.target.value))} />
            <p className="text-xs text-white/40">Adresa príspevku: /posts/{state.slug || '…'}</p>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Kategórie</Label>
            <div className="flex flex-wrap gap-4">
              {(categoriesQuery.data ?? []).map((category) => (
                <Label key={category.id} className="cursor-pointer select-none gap-2 text-white/80">
                  <Checkbox
                    checked={state.categoryIds.includes(category.id)}
                    onCheckedChange={(checked) =>
                      updateState((prev) => ({
                        ...prev,
                        categoryIds: checked
                          ? [...prev.categoryIds, category.id]
                          : prev.categoryIds.filter((categoryId) => categoryId !== category.id),
                      }))
                    }
                  />
                  {category.name}
                </Label>
              ))}
            </div>
          </div>

          <Label className="cursor-pointer select-none gap-2 text-white/80">
            <Checkbox
              checked={state.isFeatured}
              onCheckedChange={(checked) => updateState((prev) => ({ ...prev, isFeatured: checked }))}
            />
            Odporúčaný príspevok
          </Label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="youtubeId">YouTube ID</Label>
              <Input
                id="youtubeId"
                value={state.youtubeId}
                onChange={(event) => updateState((prev) => ({ ...prev, youtubeId: event.target.value }))}
                placeholder="napr. dQw4w9WgXcQ"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="soundcloudUrl">SoundCloud URL</Label>
              <Input
                id="soundcloudUrl"
                value={state.soundcloudUrl}
                onChange={(event) => updateState((prev) => ({ ...prev, soundcloudUrl: event.target.value }))}
                placeholder="https://soundcloud.com/…"
              />
            </div>
          </div>

          <ThumbnailPicker
            value={state.thumbnailPath}
            onChange={(filename) => updateState((prev) => ({ ...prev, thumbnailPath: filename }))}
            youtubeId={state.youtubeId}
          />
        </div>

        <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-glass p-4">
          <Link href="/admin/posts" className={buttonVariants({ variant: 'ghost' })}>
            Zrušiť
          </Link>
          <div className="flex flex-wrap gap-2">
            {isEdit ? (
              <Button type="button" variant="outline" disabled={saving} onClick={() => handleSave('archived')}>
                {pendingStatus === 'archived' ? 'Archivujem…' : 'Archivovať'}
              </Button>
            ) : null}
            <Button type="button" variant="outline" disabled={saving} onClick={() => handleSave('draft')}>
              {pendingStatus === 'draft' ? 'Ukladám…' : 'Uložiť koncept'}
            </Button>
            <Button type="button" disabled={saving} onClick={() => handleSave('published')}>
              {pendingStatus === 'published' ? 'Publikujem…' : 'Publikovať'}
            </Button>
          </div>
        </div>
      </div>

      <div className="lg:sticky lg:top-6 lg:h-fit lg:max-h-[calc(100dvh-3rem)]">
        <div className="glass flex h-full flex-col gap-3 overflow-y-auto rounded-glass p-4 sm:p-6">
          <h2 className="font-display text-xs font-semibold uppercase tracking-wide text-white/50">
            Náhľad — {LANGUAGE_LABEL[activeLanguage]}
          </h2>
          <MarkdownPreview markdown={state.translations[activeLanguage].content} />
        </div>
      </div>
    </div>
  );
}
