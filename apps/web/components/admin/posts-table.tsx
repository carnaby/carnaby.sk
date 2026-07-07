'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';

// Same type-only, module-boundary-safe pattern as `lib/trpc-server.ts`/`lib/trpc-react.tsx`:
// `@carnaby/api` resolves to a barrel that only re-exports the `AppRouter` type, so this import
// is fully erased at compile time.
// eslint-disable-next-line @nx/enforce-module-boundaries
import type { AppRouter } from '@carnaby/api';
import type { inferRouterOutputs } from '@trpc/server';

import { revalidateContent } from '../../lib/revalidate';
import { useTRPC } from '../../lib/trpc-react';
import { PostImage } from '../post/post-image';
import { Badge } from '../ui/badge';
import { Button, buttonVariants } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

type AdminListItem = inferRouterOutputs<AppRouter>['posts']['adminList']['items'][number];

// Mirrors `apps/api/src/posts/posts.read.ts`'s `PostStatus` / `posts.admin.ts`'s `AdminSortBy` --
// small, stable literal unions duplicated here rather than imported, so this file stays free of
// any runtime import from the api project (only the type-only `AppRouter` above is allowed to
// cross that boundary).
type PostStatus = 'draft' | 'published' | 'archived';
type StatusFilter = 'all' | PostStatus;
type SortBy = 'createdAt' | 'title' | 'status' | 'viewCount';
type SortOrder = 'asc' | 'desc';

const PAGE_SIZE = 20;

const STATUS_LABEL: Record<PostStatus, string> = {
  draft: 'Koncept',
  published: 'Publikované',
  archived: 'Archivované',
};

// Literal Tailwind classes (not computed) so the JIT scanner picks them up -- same pattern as
// `post-card.tsx`'s `CHIP_CLASS`.
const STATUS_BADGE_CLASS: Record<PostStatus, string> = {
  draft: 'border-dodo/30 bg-dodo/15 text-dodo',
  published: 'border-devlog/30 bg-devlog/15 text-devlog',
  archived: 'border-white/20 bg-white/10 text-white/60',
};

const DATE_FORMATTER = new Intl.DateTimeFormat('sk', { dateStyle: 'medium' });

interface SortButtonProps {
  label: string;
  sortKey: SortBy;
  sortBy: SortBy;
  order: SortOrder;
  onToggle: (key: SortBy) => void;
}

/** Clickable column header: label + a chevron indicating current sort direction, or a neutral
 * (dimmed) chevron when this isn't the active sort column. */
function SortButton({ label, sortKey, sortBy, order, onToggle }: SortButtonProps) {
  const active = sortBy === sortKey;
  return (
    <button
      type="button"
      onClick={() => onToggle(sortKey)}
      className="inline-flex items-center gap-1 text-white/80 transition-colors hover:text-white"
    >
      {label}
      {active ? (
        order === 'asc' ? (
          <ArrowUp size={14} aria-hidden="true" />
        ) : (
          <ArrowDown size={14} aria-hidden="true" />
        )
      ) : (
        <ArrowUpDown size={14} className="opacity-30" aria-hidden="true" />
      )}
    </button>
  );
}

/**
 * `/admin/posts` table (Task 20): filterable/sortable/paginated list of every post regardless of
 * status, with a delete flow. Owns all of its own state (filters/sort/page in `useState` -- no
 * URL sync, YAGNI per the task brief) and all tRPC/react-query calls; `app/admin/posts/page.tsx`
 * is just a thin wrapper.
 */
export function PostsTable() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<StatusFilter>('all');
  const [category, setCategory] = useState<string>('all');
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('createdAt');
  const [order, setOrder] = useState<SortOrder>('desc');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<AdminListItem | null>(null);

  const categoriesQuery = useQuery(trpc.categories.list.queryOptions());
  const listQuery = useQuery(
    trpc.posts.adminList.queryOptions({
      status: status === 'all' ? undefined : status,
      category: category === 'all' ? undefined : category,
      featured: featuredOnly ? true : undefined,
      page,
      limit: PAGE_SIZE,
      sortBy,
      order,
    }),
  );
  const removeMutation = useMutation(trpc.posts.remove.mutationOptions());

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const pageCount = listQuery.data?.pageCount ?? 1;

  function toggleSort(key: SortBy) {
    setPage(1);
    if (sortBy === key) {
      setOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setOrder('desc');
    }
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
          try {
            await revalidateContent([target.slug]);
          } catch {
            toast.warning('Príspevok bol zmazaný, ale obnovenie cache webu sa nepodarilo.');
          }
        },
        onError: () => {
          toast.error(`Zmazanie príspevku „${target.title}“ sa nepodarilo. Skúste to znova.`);
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={status}
            onValueChange={(value) => {
              // See the category select below: `onValueChange` is typed to allow `null`, but
              // this select never actually clears to one.
              if (value === null) return;
              setStatus(value);
              setPage(1);
            }}
          >
            <SelectTrigger aria-label="Stav" className="w-40">
              <SelectValue placeholder="Stav" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všetky stavy</SelectItem>
              <SelectItem value="draft">Koncept</SelectItem>
              <SelectItem value="published">Publikované</SelectItem>
              <SelectItem value="archived">Archivované</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={category}
            onValueChange={(value) => {
              // Single (non-multiple) select's `onValueChange` is typed to allow `null` (the
              // "nothing selected" case for a clearable select), which this one never is --
              // every item including "all" always carries a string value.
              if (value === null) return;
              setCategory(value);
              setPage(1);
            }}
          >
            <SelectTrigger aria-label="Kategória" className="w-48">
              <SelectValue placeholder="Kategória" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všetky kategórie</SelectItem>
              {categoriesQuery.data?.map((c) => (
                <SelectItem key={c.slug} value={c.slug}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Label className="cursor-pointer select-none">
            <Checkbox
              checked={featuredOnly}
              onCheckedChange={(checked) => {
                setFeaturedOnly(checked);
                setPage(1);
              }}
            />
            Iba odporúčané
          </Label>
        </div>

        <Link href="/admin/posts/new" className={buttonVariants()}>
          <Plus size={16} aria-hidden="true" />
          Nový príspevok
        </Link>
      </div>

      <div className="glass overflow-hidden rounded-glass">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[76px]">Náhľad</TableHead>
              <TableHead>
                <SortButton label="Názov" sortKey="title" sortBy={sortBy} order={order} onToggle={toggleSort} />
              </TableHead>
              <TableHead>Kategórie</TableHead>
              <TableHead>
                <SortButton label="Stav" sortKey="status" sortBy={sortBy} order={order} onToggle={toggleSort} />
              </TableHead>
              <TableHead className="text-right">
                <SortButton
                  label="Zobrazenia"
                  sortKey="viewCount"
                  sortBy={sortBy}
                  order={order}
                  onToggle={toggleSort}
                />
              </TableHead>
              <TableHead>
                <SortButton
                  label="Vytvorené"
                  sortKey="createdAt"
                  sortBy={sortBy}
                  order={order}
                  onToggle={toggleSort}
                />
              </TableHead>
              <TableHead className="text-right">Akcie</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-white/50">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Načítavam príspevky…
                  </div>
                </TableCell>
              </TableRow>
            ) : listQuery.isError ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center">
                  <div className="flex flex-col items-center gap-3 text-white/60">
                    <span>Nepodarilo sa načítať príspevky.</span>
                    <Button variant="outline" size="sm" onClick={() => listQuery.refetch()}>
                      Skúsiť znova
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-white/50">
                  Žiadne príspevky nenájdené.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="h-[60px] w-[60px] overflow-hidden rounded-md bg-surface">
                      <PostImage post={item} width={300} />
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs whitespace-normal">
                    <div className="flex items-center gap-1.5">
                      {item.isFeatured ? (
                        <span aria-label="Odporúčané" title="Odporúčané">
                          ⭐
                        </span>
                      ) : null}
                      <span className="truncate font-medium text-white">{item.title || '(bez názvu)'}</span>
                    </div>
                    <div className="mt-1 flex gap-1">
                      <Badge variant="secondary" className={item.hasSk ? undefined : 'opacity-30'}>
                        SK
                      </Badge>
                      <Badge variant="secondary" className={item.hasEn ? undefined : 'opacity-30'}>
                        EN
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-white/70">
                    {item.categories.map((c) => c.name).join(', ') || '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_BADGE_CLASS[item.status]}>
                      {STATUS_LABEL[item.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{item.viewCount}</TableCell>
                  <TableCell>{DATE_FORMATTER.format(new Date(item.createdAt))}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/posts/${item.id}/edit`}
                        className={buttonVariants({ variant: 'outline', size: 'sm' })}
                      >
                        Upraviť
                      </Link>
                      <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(item)}>
                        Zmazať
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-white/60">
          <span>Celkovo {total} príspevkov</span>
          <div className="flex items-center gap-2">
            <span>
              Strana {page} z {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Predchádzajúca
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              Ďalšia
            </Button>
          </div>
        </div>
      </div>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zmazať príspevok?</DialogTitle>
            <DialogDescription>
              Naozaj chcete zmazať príspevok „{deleteTarget?.title}“? Táto akcia je nevratná.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Zrušiť</DialogClose>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={removeMutation.isPending}>
              {removeMutation.isPending ? 'Mažem…' : 'Zmazať príspevok'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
