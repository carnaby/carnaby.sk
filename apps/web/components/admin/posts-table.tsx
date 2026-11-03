'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink, Loader2, MoreHorizontal, Pencil, Plus, Search, Star, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

// Type-only import from the api project: erased at compile time, so none of its runtime code
// reaches the web bundle (see lib/trpc-server.ts).
// eslint-disable-next-line @nx/enforce-module-boundaries
import type { AppRouter } from '@carnaby/api';
import type { inferRouterOutputs } from '@trpc/server';

import { cn } from '../../lib/cn';
import { useTRPC } from '../../lib/trpc-react';
import { PostImage } from '../post/post-image';
import { Badge } from '../ui/badge';
import { Button, buttonVariants } from '../ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Chip } from './chip';
import { PageHeader } from './page-header';
import { DATE_FORMATTER, STATUS_BADGE_CLASS, STATUS_DOT_CLASS, STATUS_LABEL, type PostStatus } from './status';

type AdminListItem = inferRouterOutputs<AppRouter>['posts']['adminList']['items'][number];
type SortBy = 'createdAt' | 'publishedAt' | 'title' | 'status' | 'viewCount';
type SortOrder = 'asc' | 'desc';

const PAGE_SIZE = 20;
const STATUSES: PostStatus[] = ['published', 'draft', 'archived'];
const SORT_PRESETS: { value: string; label: string; sortBy: SortBy; order: SortOrder }[] = [
  { value: 'createdAt:desc', label: 'Najnovšie', sortBy: 'createdAt', order: 'desc' },
  { value: 'publishedAt:desc', label: 'Podľa publikovania', sortBy: 'publishedAt', order: 'desc' },
  { value: 'viewCount:desc', label: 'Najčítanejšie', sortBy: 'viewCount', order: 'desc' },
  { value: 'title:asc', label: 'Názov A–Z', sortBy: 'title', order: 'asc' },
  { value: 'createdAt:asc', label: 'Najstaršie', sortBy: 'createdAt', order: 'asc' },
];

/**
 * Filters live in the URL (`?status=draft&category=dodo&q=…&missing=en&featured=1&sort=…&page=2`)
 * so the dashboard can deep-link into a filtered list and Back restores it.
 */
function useListParams() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const status = params.get('status');
  const sort = params.get('sort') ?? 'createdAt:desc';
  const [sortBy, order] = sort.split(':') as [SortBy, SortOrder];
  const filters = {
    status: STATUSES.includes(status as PostStatus) ? (status as PostStatus) : undefined,
    category: params.get('category') ?? undefined,
    featured: params.get('featured') === '1' ? true : undefined,
    missingLanguage: params.get('missing') === 'en' || params.get('missing') === 'sk' ? (params.get('missing') as 'en' | 'sk') : undefined,
    search: params.get('q') ?? '',
    page: Math.max(1, Number(params.get('page')) || 1),
    sortBy: sortBy ?? 'createdAt',
    order: order === 'asc' ? ('asc' as const) : ('desc' as const),
    sort,
  };
  function update(changes: Record<string, string | null>, keepPage = false) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    }
    if (!keepPage) next.delete('page');
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }
  return { filters, update };
}

function LanguageBadges({ item }: { item: AdminListItem }) {
  return (
    <span className="flex gap-1">
      {(['sk', 'en'] as const).map((lang) => {
        const has = lang === 'sk' ? item.hasSk : item.hasEn;
        return (
          <span
            key={lang}
            title={has ? `${lang.toUpperCase()} verzia existuje` : `Chýba ${lang.toUpperCase()} verzia`}
            className={cn(
              'rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide',
              has ? 'bg-white/10 text-white/70' : 'border border-dashed border-white/20 text-white/30',
            )}
          >
            {lang}
          </span>
        );
      })}
    </span>
  );
}

function SortButton({ label, sortKey, sortBy, order, onToggle }: { label: string; sortKey: SortBy; sortBy: SortBy; order: SortOrder; onToggle: (key: SortBy) => void }) {
  const active = sortBy === sortKey;
  const Icon = active ? (order === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <button type="button" onClick={() => onToggle(sortKey)} className="inline-flex items-center gap-1 text-white/70 transition-colors hover:text-white">
      {label}
      <Icon size={13} className={active ? undefined : 'opacity-30'} aria-hidden="true" />
    </button>
  );
}

/**
 * `/admin/posts`: every post regardless of status. Cards on phones, a table from `md` up; search,
 * chip filters and sort are URL state (see `useListParams`).
 */
export function PostsTable() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { filters, update } = useListParams();
  const [deleteTarget, setDeleteTarget] = useState<AdminListItem | null>(null);

  // Search input is local state, pushed to the URL after a short pause.
  const [searchText, setSearchText] = useState(filters.search);
  useEffect(() => {
    if (searchText.trim() === filters.search) return;
    const timer = setTimeout(() => update({ q: searchText.trim() || null }), 300);
    return () => clearTimeout(timer);
  }, [searchText, filters.search]);

  const categoriesQuery = useQuery(trpc.categories.list.queryOptions());
  const listQuery = useQuery({
    ...trpc.posts.adminList.queryOptions({
      status: filters.status,
      category: filters.category,
      featured: filters.featured,
      missingLanguage: filters.missingLanguage,
      search: filters.search || undefined,
      page: filters.page,
      limit: PAGE_SIZE,
      sortBy: filters.sortBy,
      order: filters.order,
    }),
    placeholderData: (previous) => previous,
  });
  const removeMutation = useMutation(trpc.posts.remove.mutationOptions());
  const featuredMutation = useMutation(trpc.posts.setFeatured.mutationOptions());

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const pageCount = listQuery.data?.pageCount ?? 1;
  const hasFilters = Boolean(filters.status || filters.category || filters.featured || filters.missingLanguage || filters.search);

  function toggleSort(key: SortBy) {
    const nextOrder: SortOrder = filters.sortBy === key && filters.order === 'desc' ? 'asc' : 'desc';
    update({ sort: `${key}:${nextOrder}` });
  }

  function toggleFeatured(item: AdminListItem) {
    const next = !item.isFeatured;
    featuredMutation.mutate(
      { id: item.id, isFeatured: next },
      {
        onSuccess: async () => {
          toast.success(next ? `„${item.title}“ je odporúčaný.` : `„${item.title}“ už nie je odporúčaný.`);
          await queryClient.invalidateQueries(trpc.posts.adminList.queryFilter());
          await queryClient.invalidateQueries(trpc.posts.adminStats.queryFilter());
        },
        onError: () => toast.error('Zmena odporúčania sa nepodarila. Skúste to znova.'),
      },
    );
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    removeMutation.mutate(
      { id: target.id },
      {
        onSuccess: async () => {
          toast.success(`Príspevok „${target.title}“ bol zmazaný.`);
          setDeleteTarget(null);
          await queryClient.invalidateQueries(trpc.posts.adminList.queryFilter());
          await queryClient.invalidateQueries(trpc.posts.adminStats.queryFilter());
        },
        onError: () => toast.error(`Zmazanie príspevku „${target.title}“ sa nepodarilo. Skúste to znova.`),
      },
    );
  }

  const featuredBusy = (item: AdminListItem) => featuredMutation.isPending && featuredMutation.variables?.id === item.id;

  return (
    <div>
      <PageHeader
        title="Príspevky"
        description={listQuery.data ? `${total} ${hasFilters ? 'vyhovuje filtru' : 'spolu'}` : 'Načítavam…'}
        actions={
          <Link href="/admin/posts/new" className={cn(buttonVariants(), 'hidden md:inline-flex')}>
            <Plus aria-hidden="true" />
            Nový príspevok
          </Link>
        }
      />

      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/35" aria-hidden="true" />
            <Input
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Hľadať v názvoch a slugoch…"
              aria-label="Hľadať"
              className="h-10 pl-9 lg:h-9"
            />
          </div>
          <select
            aria-label="Zoradiť"
            value={filters.sort}
            onChange={(event) => update({ sort: event.target.value === 'createdAt:desc' ? null : event.target.value })}
            className="h-10 shrink-0 rounded-lg border border-input bg-input/30 px-2.5 text-sm text-white outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:h-9"
          >
            {SORT_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value} className="bg-card">
                {preset.label}
              </option>
            ))}
          </select>
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
          <Chip active={!filters.status} onClick={() => update({ status: null })}>
            Všetky
          </Chip>
          {STATUSES.map((status) => (
            <Chip key={status} active={filters.status === status} onClick={() => update({ status: filters.status === status ? null : status })}>
              <span className={cn('size-1.5 rounded-full', STATUS_DOT_CLASS[status])} />
              {STATUS_LABEL[status]}
            </Chip>
          ))}
          <span className="mx-1 w-px shrink-0 bg-line" aria-hidden="true" />
          {(categoriesQuery.data ?? []).map((c) => (
            <Chip key={c.slug} active={filters.category === c.slug} onClick={() => update({ category: filters.category === c.slug ? null : c.slug })}>
              {c.name}
            </Chip>
          ))}
          <span className="mx-1 w-px shrink-0 bg-line" aria-hidden="true" />
          <Chip active={Boolean(filters.featured)} onClick={() => update({ featured: filters.featured ? null : '1' })}>
            <Star className="size-3.5" aria-hidden="true" />
            Odporúčané
          </Chip>
          <Chip active={filters.missingLanguage === 'en'} onClick={() => update({ missing: filters.missingLanguage === 'en' ? null : 'en' })}>
            Bez EN
          </Chip>
          {hasFilters ? (
            <button
              type="button"
              onClick={() => {
                setSearchText('');
                update({ status: null, category: null, featured: null, missing: null, q: null });
              }}
              className="inline-flex h-9 shrink-0 items-center gap-1 px-2 text-sm text-white/50 hover:text-white lg:h-8"
            >
              <X className="size-3.5" aria-hidden="true" />
              Zrušiť filtre
            </button>
          ) : null}
        </div>
      </div>

      {listQuery.isLoading ? (
        <div className="glass flex items-center justify-center gap-2 rounded-glass p-10 text-white/50">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Načítavam príspevky…
        </div>
      ) : listQuery.isError ? (
        <div className="glass flex flex-col items-center gap-3 rounded-glass p-10 text-white/60">
          <span>Nepodarilo sa načítať príspevky.</span>
          <Button variant="outline" size="sm" onClick={() => listQuery.refetch()}>
            Skúsiť znova
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="glass rounded-glass p-10 text-center text-white/50">
          {hasFilters ? 'Filtru nevyhovuje žiadny príspevok.' : 'Zatiaľ žiadne príspevky.'}
        </div>
      ) : (
        <>
          {/* Phones: cards */}
          <ul className={cn('flex flex-col gap-2 md:hidden', listQuery.isFetching && 'opacity-60')}>
            {items.map((item) => (
              <li key={item.id} className="glass relative flex gap-3 rounded-glass p-3">
                <Link href={`/admin/posts/${item.id}/edit`} className="absolute inset-0 rounded-glass" aria-label={`Upraviť: ${item.title}`} />
                <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-surface">
                  <PostImage post={item} width={300} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[15px] font-medium leading-snug text-white">{item.title || '(bez názvu)'}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/45">
                    <span className="inline-flex items-center gap-1">
                      <span className={cn('size-1.5 rounded-full', STATUS_DOT_CLASS[item.status])} />
                      {STATUS_LABEL[item.status]}
                    </span>
                    <LanguageBadges item={item} />
                    {item.categories[0] ? <span>{item.categories.map((c) => c.name).join(', ')}</span> : null}
                    <span className="tabular-nums">{item.viewCount}×</span>
                  </div>
                </div>
                <div className="relative z-10 -mr-1 flex shrink-0 flex-col items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-pressed={item.isFeatured}
                    aria-label={item.isFeatured ? 'Zrušiť odporúčanie' : 'Odporučiť'}
                    disabled={featuredBusy(item)}
                    onClick={() => toggleFeatured(item)}
                    className="size-10"
                  >
                    <Star className={item.isFeatured ? 'size-5 fill-dodo text-dodo' : 'size-5 text-white/30'} aria-hidden="true" />
                  </Button>
                  <RowMenu item={item} onDelete={() => setDeleteTarget(item)} />
                </div>
              </li>
            ))}
          </ul>

          {/* md+: table */}
          <div className={cn('glass hidden overflow-hidden rounded-glass md:block', listQuery.isFetching && 'opacity-60')}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[72px]" />
                  <TableHead className="w-full">
                    <SortButton label="Názov" sortKey="title" sortBy={filters.sortBy} order={filters.order} onToggle={toggleSort} />
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">Kategória</TableHead>
                  <TableHead>
                    <SortButton label="Stav" sortKey="status" sortBy={filters.sortBy} order={filters.order} onToggle={toggleSort} />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortButton label="Videné" sortKey="viewCount" sortBy={filters.sortBy} order={filters.order} onToggle={toggleSort} />
                  </TableHead>
                  <TableHead className="hidden xl:table-cell">
                    <SortButton label="Vytvorené" sortKey="createdAt" sortBy={filters.sortBy} order={filters.order} onToggle={toggleSort} />
                  </TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Akcie</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} className="group">
                    <TableCell>
                      <div className="size-12 overflow-hidden rounded-md bg-surface">
                        <PostImage post={item} width={300} />
                      </div>
                    </TableCell>
                    {/* max-w-0 + w-full: the title takes the leftover width and truncates. */}
                    <TableCell className="w-full max-w-0">
                      <Link href={`/admin/posts/${item.id}/edit`} className="block truncate font-medium text-white hover:underline" title={item.title}>
                        {item.title || '(bez názvu)'}
                      </Link>
                      <div className="mt-1 flex items-center gap-2">
                        <LanguageBadges item={item} />
                        <span className="truncate text-xs text-white/35">/{item.slug}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-white/70 lg:table-cell">{item.categories.map((c) => c.name).join(', ') || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_BADGE_CLASS[item.status]}>
                        {STATUS_LABEL[item.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{item.viewCount}</TableCell>
                    <TableCell className="hidden text-white/60 xl:table-cell">{DATE_FORMATTER.format(new Date(item.createdAt))}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-pressed={item.isFeatured}
                          aria-label={item.isFeatured ? 'Zrušiť odporúčanie' : 'Odporučiť'}
                          title={item.isFeatured ? 'Odporúčaný — kliknutím zrušíš' : 'Odporučiť'}
                          disabled={featuredBusy(item)}
                          onClick={() => toggleFeatured(item)}
                        >
                          <Star className={item.isFeatured ? 'size-4 fill-dodo text-dodo' : 'size-4 text-white/30'} aria-hidden="true" />
                        </Button>
                        <Link href={`/admin/posts/${item.id}/edit`} aria-label="Upraviť" title="Upraviť" className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}>
                          <Pencil className="size-4" aria-hidden="true" />
                        </Link>
                        <RowMenu item={item} onDelete={() => setDeleteTarget(item)} compact />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {pageCount > 1 ? (
            <div className="mt-4 flex items-center justify-between gap-3 text-sm text-white/55">
              <Button variant="outline" className="h-10 lg:h-8" disabled={filters.page <= 1} onClick={() => update({ page: String(filters.page - 1) }, true)}>
                Predchádzajúca
              </Button>
              <span className="tabular-nums">
                {filters.page} / {pageCount}
              </span>
              <Button variant="outline" className="h-10 lg:h-8" disabled={filters.page >= pageCount} onClick={() => update({ page: String(filters.page + 1) }, true)}>
                Ďalšia
              </Button>
            </div>
          ) : null}
        </>
      )}

      {/* Phones: floating "new post" button above the tab bar */}
      <Link
        href="/admin/posts/new"
        aria-label="Nový príspevok"
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-20 flex size-14 items-center justify-center rounded-full bg-white text-black shadow-lg shadow-black/50 transition-transform active:scale-95 md:hidden"
      >
        <Plus className="size-6" aria-hidden="true" />
      </Link>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zmazať príspevok?</DialogTitle>
            <DialogDescription>
              „{deleteTarget?.title}“ sa zmaže natrvalo aj s oboma jazykovými verziami. Ak ho chceš len skryť, archivuj ho v editore.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Zrušiť</DialogClose>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={removeMutation.isPending}>
              {removeMutation.isPending ? 'Mažem…' : 'Zmazať natrvalo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RowMenu({ item, onDelete, compact }: { item: AdminListItem; onDelete: () => void; compact?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size={compact ? 'icon-sm' : 'icon'} aria-label="Ďalšie akcie" className={compact ? undefined : 'size-10'} />
        }
      >
        <MoreHorizontal className={compact ? 'size-4' : 'size-5 text-white/50'} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem className="py-2.5 lg:py-1" render={<Link href={`/admin/posts/${item.id}/edit`} />}>
          <Pencil aria-hidden="true" />
          Upraviť
        </DropdownMenuItem>
        {item.status === 'published' ? (
          <DropdownMenuItem className="py-2.5 lg:py-1" render={<a href={`/posts/${item.slug}`} target="_blank" rel="noreferrer" />}>
            <ExternalLink aria-hidden="true" />
            Zobraziť na webe
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="py-2.5 lg:py-1" variant="destructive" onClick={onDelete}>
          <Trash2 aria-hidden="true" />
          Zmazať
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
