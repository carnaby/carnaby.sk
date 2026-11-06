'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CirclePlay, Copy, ExternalLink, Eye, Loader2, MoreHorizontal, PenLine, Star } from 'lucide-react';
import { toast } from 'sonner';

// Type-only import from the api project: erased at compile time, so none of its runtime code
// reaches the web bundle (see lib/trpc-server.ts).
// eslint-disable-next-line @nx/enforce-module-boundaries
import type { AppRouter } from '@carnaby/api';
import type { inferRouterOutputs } from '@trpc/server';

import { cn } from '../../lib/cn';
import { useTRPC } from '../../lib/trpc-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Chip } from './chip';
import { MarkdownPreview } from './markdown-preview';
import { STATUS_BADGE_CLASS, STATUS_LABEL } from './status';
import { ThumbnailPicker } from './thumbnail-picker';
import {
  applyYoutubePreview,
  buildUpsertInput,
  copyTranslation,
  createEmptyState,
  emptyTranslation,
  isTranslationPartial,
  isTranslationPresent,
  setSlug,
  setTranslationField,
  type EditorState,
  type PostStatus,
  type TranslationField,
  type TranslationFormState,
} from './editor-state';

type PostByIdResult = inferRouterOutputs<AppRouter>['posts']['byId'];

// Duplicated small literal union -- keeps this file free of any runtime import from the api.
type Language = 'sk' | 'en';

const LANGUAGE_LABEL: Record<Language, string> = { sk: 'Slovensky', en: 'English' };
const OTHER_LANGUAGE: Record<Language, Language> = { sk: 'en', en: 'sk' };

export type PostEditorMode = 'new' | { id: number };

export interface PostEditorProps {
  mode: PostEditorMode;
}

/** Converts the api's `posts.byId` shape into this component's free-form `EditorState`.
 * `slugTouched: true` -- the slug of an existing post never auto-changes as its title is edited. */
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
    projectUrl: data.post.projectUrl ?? '',
    thumbnailPath: data.post.thumbnailPath ?? '',
    categoryIds: data.categoryIds,
    publishedAt: data.post.publishedAt ?? '',
    translations: { sk: toForm(data.translations.sk), en: toForm(data.translations.en) },
  };
}

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('glass flex flex-col gap-4 rounded-glass p-4 sm:p-5', className)}>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-white/45">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-white/40">{hint}</p> : null}
    </div>
  );
}

const INPUT_CLASS = 'h-10 lg:h-9';

/**
 * Bilingual markdown post editor.
 *
 * Phones: one column, a "Písať / Náhľad" switch instead of the side preview, and a fixed action
 * bar at the bottom (the admin tab bar is hidden on this screen). xl+: live preview column.
 * Saving keeps you on the page; a new post moves to its edit URL. Cmd/Ctrl+S saves without
 * changing the status, and leaving with unsaved changes asks first.
 *
 * All state lives in one `EditorState` manipulated through `editor-state.ts`'s pure helpers.
 */
export function PostEditor({ mode }: PostEditorProps) {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const isEdit = mode !== 'new';
  const id = isEdit ? mode.id : undefined;

  const categoriesQuery = useQuery(trpc.categories.list.queryOptions());
  const postQuery = useQuery({ ...trpc.posts.byId.queryOptions({ id: id ?? -1 }), enabled: isEdit });

  // `manualState` is `null` until the first edit; until then `state` is derived straight from the
  // loaded post (or a blank slate) -- no effect needed to sync the form with the async query.
  const deriveHydratedState = useCallback(
    () => (isEdit && postQuery.data ? fromPostById(postQuery.data) : createEmptyState()),
    [isEdit, postQuery.data],
  );
  const [manualState, setManualState] = useState<EditorState | null>(null);
  const state: EditorState = manualState ?? deriveHydratedState();

  // Dirty tracking: compare against the last saved (or loaded) state.
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const dirty = manualState !== null && JSON.stringify(state) !== (savedSnapshot ?? JSON.stringify(deriveHydratedState()));

  const [activeLanguage, setActiveLanguage] = useState<Language>('sk');
  const [view, setView] = useState<'write' | 'preview'>('write');
  const [errors, setErrors] = useState<string[]>([]);
  const [pendingStatus, setPendingStatus] = useState<PostStatus | null>(null);

  function updateState(updater: (prev: EditorState) => EditorState) {
    setManualState((prev) => updater(prev ?? deriveHydratedState()));
  }

  const createMutation = useMutation(trpc.posts.create.mutationOptions());
  const updateMutation = useMutation(trpc.posts.update.mutationOptions());
  const saving = createMutation.isPending || updateMutation.isPending;
  const youtubePreview = useMutation(trpc.youtube.preview.mutationOptions());

  // Leaving the page (reload, close tab, external link) with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function handleLoadFromYoutube() {
    const videoId = state.youtubeId.trim();
    if (!videoId) return;
    youtubePreview.mutate(
      { videoId },
      {
        onSuccess: (preview) => {
          updateState((prev) => applyYoutubePreview(prev, preview));
          toast.success('Údaje z YouTube sú vo formulári — skontroluj ich a ulož.');
          if (preview.thumbnailError) toast.warning(`Náhľad z YouTube sa nepodarilo stiahnuť: ${preview.thumbnailError}`);
        },
        onError: (error) => toast.error(error.message || 'Načítanie z YouTube sa nepodarilo.'),
      },
    );
  }

  function handleSave(status: PostStatus) {
    const next = { ...state, status };
    const result = buildUpsertInput(next);
    if ('errors' in result) {
      setErrors(result.errors);
      toast.error('Formulár obsahuje chyby.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setErrors([]);
    setPendingStatus(status);
    const { input } = result;

    const invalidate = async () => {
      await Promise.all([
        queryClient.invalidateQueries(trpc.posts.adminList.queryFilter()),
        queryClient.invalidateQueries(trpc.posts.adminStats.queryFilter()),
        queryClient.invalidateQueries(trpc.youtube.overview.queryFilter()),
      ]);
    };
    const onError = (error: unknown) => {
      setPendingStatus(null);
      toast.error(error instanceof Error ? error.message : 'Uloženie príspevku sa nepodarilo.');
    };
    const message =
      status === 'published' && state.status !== 'published'
        ? 'Príspevok je publikovaný.'
        : status === 'archived' && state.status !== 'archived'
          ? 'Príspevok je archivovaný.'
          : 'Uložené.';

    if (mode === 'new') {
      createMutation.mutate(input, {
        onSuccess: async ({ id: newId }) => {
          toast.success(status === 'published' ? 'Príspevok je publikovaný.' : 'Koncept je uložený.');
          setSavedSnapshot(JSON.stringify(next));
          await invalidate();
          router.replace(`/admin/posts/${newId}/edit`);
        },
        onError,
      });
    } else {
      updateMutation.mutate(
        { id: mode.id, ...input },
        {
          onSuccess: async () => {
            setPendingStatus(null);
            setManualState(next);
            setSavedSnapshot(JSON.stringify(next));
            toast.success(message);
            await invalidate();
            await queryClient.invalidateQueries(trpc.posts.byId.queryFilter({ id: mode.id }));
          },
          onError,
        },
      );
    }
  }

  // Cmd/Ctrl+S: save, keeping the current status (a new post becomes a draft).
  const saveRef = useRef<() => void>(() => undefined);
  saveRef.current = () => {
    if (!saving) handleSave(isEdit ? state.status : 'draft');
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function confirmLeave(event: React.MouseEvent) {
    if (dirty && !window.confirm('Máš neuložené zmeny. Naozaj odísť?')) event.preventDefault();
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

  const translation = state.translations[activeLanguage];
  const other = OTHER_LANGUAGE[activeLanguage];
  const present = isTranslationPresent(translation);
  const partial = isTranslationPartial(translation);
  const otherPresent = isTranslationPresent(state.translations[other]);
  const headerTitle = state.translations.sk.title || state.translations.en.title || (isEdit ? '(bez názvu)' : 'Nový príspevok');
  const savedStatus: PostStatus = isEdit ? (JSON.parse(savedSnapshot ?? 'null')?.status ?? postQuery.data?.post.status ?? 'draft') : 'draft';

  const preview = (
    <div className="flex flex-col gap-4">
      {translation.title ? <h1 className="font-display text-2xl font-bold tracking-tight text-white">{translation.title}</h1> : null}
      {translation.excerpt ? <p className="text-white/60">{translation.excerpt}</p> : null}
      <MarkdownPreview markdown={translation.content} />
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex items-start gap-2 lg:mb-6">
        <Link
          href="/admin/posts"
          onClick={confirmLeave}
          aria-label="Späť na príspevky"
          className="-ml-2 flex size-10 shrink-0 items-center justify-center rounded-lg text-white/60 hover:bg-white/5 hover:text-white"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
        <div className="min-w-0 flex-1 pt-1">
          <h1 className="line-clamp-2 font-display text-xl font-semibold tracking-tight text-white lg:text-2xl">{headerTitle}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-white/45">
            <Badge variant="outline" className={STATUS_BADGE_CLASS[savedStatus]}>
              {isEdit ? STATUS_LABEL[savedStatus] : 'Nový'}
            </Badge>
            {dirty ? <span className="text-dodo">• Neuložené zmeny</span> : null}
            {isEdit && savedStatus === 'published' ? (
              <a href={`/posts/${state.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-white">
                Zobraziť na webe <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            ) : null}
          </div>
        </div>
      </div>

      {errors.length > 0 ? (
        <div role="alert" className="mb-4 rounded-glass border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <p className="mb-1 font-medium">Formulár obsahuje chyby:</p>
          <ul className="list-disc pl-5">
            {errors.map((message, index) => (
              <li key={index}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
          {/* Content */}
          <section className="glass flex flex-col gap-4 rounded-glass p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div role="tablist" aria-label="Jazyk" className="flex rounded-lg bg-white/[0.06] p-1">
                {(['sk', 'en'] as const).map((language) => {
                  const has = isTranslationPresent(state.translations[language]);
                  return (
                    <button
                      key={language}
                      type="button"
                      role="tab"
                      aria-selected={activeLanguage === language}
                      onClick={() => setActiveLanguage(language)}
                      className={cn(
                        'flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors lg:h-8',
                        activeLanguage === language ? 'bg-white text-black' : 'text-white/60 hover:text-white',
                      )}
                    >
                      {language.toUpperCase()}
                      <span className={cn('size-1.5 rounded-full', has ? 'bg-devlog' : 'bg-white/25')} title={has ? 'Vyplnené' : 'Chýba'} />
                    </button>
                  );
                })}
              </div>
              <div className="flex rounded-lg bg-white/[0.06] p-1 xl:hidden" role="group" aria-label="Zobrazenie">
                {(
                  [
                    ['write', 'Písať', PenLine],
                    ['preview', 'Náhľad', Eye],
                  ] as const
                ).map(([value, label, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={view === value}
                    onClick={() => setView(value)}
                    className={cn(
                      'flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors lg:h-8',
                      view === value ? 'bg-white/15 text-white' : 'text-white/55 hover:text-white',
                    )}
                  >
                    <Icon className="size-3.5" aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {view === 'preview' ? (
              <div className="min-h-[40dvh] xl:hidden">{preview}</div>
            ) : null}

            <div className={cn('flex flex-col gap-4', view === 'preview' && 'hidden xl:flex')}>
              {!present && !partial ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-white/15 px-4 py-3 text-sm text-white/55">
                  <span>{LANGUAGE_LABEL[activeLanguage]} verzia zatiaľ chýba.</span>
                  {otherPresent ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => updateState((prev) => copyTranslation(prev, other, activeLanguage))}>
                      <Copy aria-hidden="true" />
                      Skopírovať z {other.toUpperCase()}
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {partial ? (
                // No copy button here: it would overwrite what is already typed in this tab.
                <p className="text-sm text-dodo">Rozpísaný preklad — doplň titulok aj obsah.</p>
              ) : null}

              <Field label="Titulok" htmlFor={`title-${activeLanguage}`}>
                <Input
                  id={`title-${activeLanguage}`}
                  value={translation.title}
                  onChange={(event) => updateField(activeLanguage, 'title', event.target.value)}
                  className="h-11 text-base font-medium lg:h-10"
                />
              </Field>

              <Field label="Krátky popis" htmlFor={`excerpt-${activeLanguage}`} hint="1–2 vety na kartu príspevku.">
                <Textarea
                  id={`excerpt-${activeLanguage}`}
                  className="min-h-20"
                  value={translation.excerpt}
                  onChange={(event) => updateField(activeLanguage, 'excerpt', event.target.value)}
                />
              </Field>

              <Field label="Obsah (Markdown)" htmlFor={`content-${activeLanguage}`}>
                <Textarea
                  id={`content-${activeLanguage}`}
                  className="min-h-[50dvh] font-mono text-sm leading-relaxed lg:min-h-[420px]"
                  value={translation.content}
                  onChange={(event) => updateField(activeLanguage, 'content', event.target.value)}
                />
              </Field>

              <Field
                label="Meta popis (SEO)"
                htmlFor={`meta-${activeLanguage}`}
                hint={`${translation.metaDescription.length}/160 znakov`}
              >
                <Input
                  id={`meta-${activeLanguage}`}
                  value={translation.metaDescription}
                  onChange={(event) => updateField(activeLanguage, 'metaDescription', event.target.value)}
                  className={INPUT_CLASS}
                />
              </Field>
            </div>
          </section>

          <Section title="Publikovanie">
            <Field
              label="Slug"
              htmlFor="slug"
              hint={
                <>
                  carnaby.sk/posts/{state.slug || '…'} · dátum publikovania:{' '}
                  {state.publishedAt
                    ? new Intl.DateTimeFormat('sk', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(state.publishedAt))
                    : 'pri prvom publikovaní'}
                </>
              }
            >
              <Input id="slug" value={state.slug} onChange={(event) => updateState((prev) => setSlug(prev, event.target.value))} className={cn(INPUT_CLASS, 'font-mono text-sm')} />
            </Field>

            <div className="flex flex-col gap-2">
              <Label>Kategórie</Label>
              <div className="flex flex-wrap gap-2">
                {(categoriesQuery.data ?? []).map((category) => {
                  const selected = state.categoryIds.includes(category.id);
                  return (
                    <Chip
                      key={category.id}
                      active={selected}
                      onClick={() =>
                        updateState((prev) => ({
                          ...prev,
                          categoryIds: selected ? prev.categoryIds.filter((c) => c !== category.id) : [...prev.categoryIds, category.id],
                        }))
                      }
                    >
                      {category.name}
                    </Chip>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={state.isFeatured}
              onClick={() => updateState((prev) => ({ ...prev, isFeatured: !prev.isFeatured }))}
              className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white/[0.02] px-3 py-3 text-left"
            >
              <span className="flex items-center gap-2.5">
                <Star className={state.isFeatured ? 'size-4 fill-dodo text-dodo' : 'size-4 text-white/35'} aria-hidden="true" />
                <span>
                  <span className="block text-sm font-medium text-white">Odporúčaný</span>
                  <span className="block text-xs text-white/40">Zobrazí sa medzi odporúčanými na úvodnej stránke.</span>
                </span>
              </span>
              <span className={cn('relative h-6 w-10 shrink-0 rounded-full transition-colors', state.isFeatured ? 'bg-dodo' : 'bg-white/15')}>
                <span className={cn('absolute top-0.5 size-5 rounded-full bg-white transition-all', state.isFeatured ? 'left-[18px]' : 'left-0.5')} />
              </span>
            </button>
          </Section>

          <Section title="Médiá">
            <Field label="YouTube ID" htmlFor="youtubeId">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="youtubeId"
                  value={state.youtubeId}
                  onChange={(event) => updateState((prev) => ({ ...prev, youtubeId: event.target.value }))}
                  placeholder="napr. dQw4w9WgXcQ"
                  className={cn(INPUT_CLASS, 'font-mono text-sm')}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 lg:h-9"
                  disabled={!state.youtubeId.trim() || youtubePreview.isPending}
                  onClick={handleLoadFromYoutube}
                  title="Prepíše texty v jazykoch, ktoré má video na YouTube, a doplní dátum vydania a náhľad. Ostatné jazyky nechá tak. Neuloží."
                >
                  {youtubePreview.isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <CirclePlay aria-hidden="true" />}
                  Načítať z YouTube
                </Button>
              </div>
            </Field>
            <Field label="SoundCloud URL" htmlFor="soundcloudUrl">
              <Input
                id="soundcloudUrl"
                type="url"
                inputMode="url"
                value={state.soundcloudUrl}
                onChange={(event) => updateState((prev) => ({ ...prev, soundcloudUrl: event.target.value }))}
                placeholder="https://soundcloud.com/…"
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Odkaz na projekt" htmlFor="projectUrl">
              <Input
                id="projectUrl"
                type="url"
                inputMode="url"
                value={state.projectUrl}
                onChange={(event) => updateState((prev) => ({ ...prev, projectUrl: event.target.value }))}
                placeholder="https://…"
                className={INPUT_CLASS}
              />
            </Field>
            <ThumbnailPicker
              value={state.thumbnailPath}
              onChange={(filename) => updateState((prev) => ({ ...prev, thumbnailPath: filename }))}
              youtubeId={state.youtubeId}
              projectUrl={state.projectUrl}
            />
          </Section>
        </div>

        {/* xl+: live preview */}
        <aside className="hidden xl:block">
          <div className="glass sticky top-8 max-h-[calc(100dvh-4rem)] overflow-y-auto rounded-glass p-5">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/45">Náhľad — {activeLanguage.toUpperCase()}</p>
            {preview}
          </div>
        </aside>
      </div>

      {/* Action bar: fixed on phones (replaces the tab bar), sticky card from lg up */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-page/90 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl lg:sticky lg:bottom-6 lg:mt-6 lg:rounded-glass lg:border lg:bg-card/90 lg:px-4 lg:pb-3">
        <div className="mx-auto flex max-w-6xl items-center gap-2">
          <span className="hidden flex-1 text-xs text-white/40 lg:block">
            {dirty ? 'Neuložené zmeny · ⌘S uloží' : 'Všetko uložené'}
          </span>
          <ActionButtons
            isEdit={isEdit}
            status={savedStatus}
            saving={saving}
            pendingStatus={pendingStatus}
            onSave={handleSave}
          />
        </div>
      </div>
    </div>
  );
}

function ActionButtons({
  isEdit,
  status,
  saving,
  pendingStatus,
  onSave,
}: {
  isEdit: boolean;
  status: PostStatus;
  saving: boolean;
  pendingStatus: PostStatus | null;
  onSave: (status: PostStatus) => void;
}) {
  const busy = (s: PostStatus) => saving && pendingStatus === s;
  const spinner = <Loader2 className="size-4 animate-spin" aria-hidden="true" />;
  const big = 'h-11 flex-1 text-[15px] lg:h-9 lg:flex-none lg:text-sm';

  // Secondary transitions live in a menu so the bar holds at most two big buttons on a phone.
  const menuItems: { label: string; status: PostStatus }[] = [];
  if (isEdit && status === 'published') menuItems.push({ label: 'Stiahnuť do konceptu', status: 'draft' });
  if (isEdit && status !== 'archived') menuItems.push({ label: 'Archivovať', status: 'archived' });
  if (isEdit && status === 'archived') menuItems.push({ label: 'Obnoviť ako koncept', status: 'draft' });

  const menu = menuItems.length ? (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Ďalšie akcie" className="size-11 shrink-0 lg:size-9" disabled={saving} />}>
        <MoreHorizontal className="size-5" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="min-w-48">
        {menuItems.map((item) => (
          <DropdownMenuItem key={item.label} className="py-2.5 lg:py-1.5" onClick={() => onSave(item.status)}>
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  if (status === 'published') {
    return (
      <>
        {menu}
        <Button type="button" className={big} disabled={saving} onClick={() => onSave('published')}>
          {busy('published') ? spinner : null}
          Uložiť zmeny
        </Button>
      </>
    );
  }

  return (
    <>
      {menu}
      <Button type="button" variant="outline" className={big} disabled={saving} onClick={() => onSave(status)}>
        {busy(status) ? spinner : null}
        {status === 'archived' ? 'Uložiť' : 'Uložiť koncept'}
      </Button>
      <Button type="button" className={big} disabled={saving} onClick={() => onSave('published')}>
        {busy('published') ? spinner : null}
        Publikovať
      </Button>
    </>
  );
}
