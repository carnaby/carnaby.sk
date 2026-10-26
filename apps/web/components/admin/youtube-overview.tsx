'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

// eslint-disable-next-line @nx/enforce-module-boundaries
import type { AppRouter } from '@carnaby/api';
import type { inferRouterOutputs } from '@trpc/server';

import { useTRPC } from '../../lib/trpc-react';
import { Badge } from '../ui/badge';
import { Button, buttonVariants } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

type Overview = inferRouterOutputs<AppRouter>['youtube']['overview'];
type Video = Overview['videos'][number];
type PostStatus = 'draft' | 'published' | 'archived';
type Filter = 'missing' | 'all';

const STATUS_LABEL: Record<PostStatus, string> = { draft: 'Koncept', published: 'Na webe', archived: 'Archivované' };
const STATUS_BADGE_CLASS: Record<PostStatus, string> = {
  draft: 'border-dodo/30 bg-dodo/15 text-dodo',
  published: 'border-devlog/30 bg-devlog/15 text-devlog',
  archived: 'border-white/20 bg-white/10 text-white/60',
};
const DATE_FORMATTER = new Intl.DateTimeFormat('sk', { dateStyle: 'medium' });

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

function NotConfigured({ missing }: { missing: string[] }) {
  return (
    <div className="glass rounded-glass p-6 text-sm text-white/70">
      <h2 className="font-display text-lg font-semibold text-white">YouTube nie je nastavený</h2>
      <p className="mt-2">
        Na serveri chýba: <code className="text-white">{missing.join(', ')}</code>. Doplň do <code>.env</code> stacku
        (a reštartuj api):
      </p>
      <pre className="mt-3 overflow-x-auto rounded-lg bg-black/40 p-3 text-xs text-white/80">
        {'YOUTUBE_API_KEY=AIza...            # Google Cloud → YouTube Data API v3 → API key\n'}
        {'YOUTUBE_CHANNELS=@carnaby=carnaby  # handle alebo UC… id, voliteľne =kategória; viac oddeľ čiarkou'}
      </pre>
    </div>
  );
}

/**
 * `/admin/youtube`: every public video of the configured channels next to the post that embeds
 * it. Missing videos get "Uverejniť" / "Ako koncept", which create the post server-side
 * (`youtube.import`) from the video's title, description, release date and still.
 */
export function YoutubeOverview() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('missing');
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Normal loads use the api's 10-minute channel cache (YouTube API quota); "Obnoviť z YouTube"
  // does one uncached fetch and stores the result under the normal key.
  const overviewOptions = trpc.youtube.overview.queryOptions({ refresh: false });
  const overviewQuery = useQuery({ ...overviewOptions, staleTime: 60_000 });
  const importMutation = useMutation(trpc.youtube.import.mutationOptions());

  async function reload() {
    setRefreshing(true);
    try {
      const fresh = await queryClient.fetchQuery({ ...trpc.youtube.overview.queryOptions({ refresh: true }), staleTime: 0 });
      queryClient.setQueryData(overviewOptions.queryKey, fresh);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Obnovenie z YouTube sa nepodarilo.');
    } finally {
      setRefreshing(false);
    }
  }

  function handleImport(video: Video, status: 'published' | 'draft') {
    setPendingId(video.id);
    importMutation.mutate(
      { videoId: video.id, status },
      {
        onSuccess: async (result) => {
          toast.success(status === 'published' ? `„${video.title}“ je na webe.` : `„${video.title}“ je uložené ako koncept.`, {
            action: { label: 'Upraviť', onClick: () => router.push(`/admin/posts/${result.id}/edit`) },
          });
          if (result.thumbnailError) toast.warning(`Náhľad sa nepodarilo stiahnuť: ${result.thumbnailError}`);
          await queryClient.invalidateQueries(trpc.youtube.overview.queryFilter());
          await queryClient.invalidateQueries(trpc.posts.adminList.queryFilter());
        },
        onError: (error) => toast.error(error.message || 'Uverejnenie sa nepodarilo.'),
        onSettled: () => setPendingId(null),
      },
    );
  }

  if (overviewQuery.isLoading) {
    return (
      <div className="glass flex items-center justify-center gap-2 rounded-glass p-10 text-white/50">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Načítavam videá z YouTube…
      </div>
    );
  }
  if (overviewQuery.isError || !overviewQuery.data) {
    return (
      <div className="glass flex flex-col items-center gap-3 rounded-glass p-10 text-white/60">
        <span>{overviewQuery.error?.message ?? 'Načítanie z YouTube sa nepodarilo.'}</span>
        <Button variant="outline" size="sm" onClick={() => overviewQuery.refetch()}>
          Skúsiť znova
        </Button>
      </div>
    );
  }

  const overview = overviewQuery.data;
  if (!overview.configured) return <NotConfigured missing={overview.missing} />;

  const missingCount = overview.videos.filter((v) => !v.post).length;
  const videos = filter === 'missing' ? overview.videos.filter((v) => !v.post) : overview.videos;

  return (
    <div className="flex flex-col gap-4">
      {overview.channels
        .filter((c) => c.error)
        .map((c) => (
          <div key={c.ref} role="alert" className="glass rounded-glass border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Kanál {c.ref}: {c.error}
          </div>
        ))}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Button variant={filter === 'missing' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('missing')}>
            Chýba na webe ({missingCount})
          </Button>
          <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>
            Všetky videá ({overview.videos.length})
          </Button>
          <span className="text-white/40">
            {overview.channels.filter((c) => !c.error).map((c) => `${c.title}${c.category ? ` → ${c.category}` : ''}`).join(' · ')}
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={reload} disabled={refreshing || overviewQuery.isFetching}>
          <RefreshCw className={refreshing ? 'size-3.5 animate-spin' : 'size-3.5'} aria-hidden="true" />
          Obnoviť z YouTube
        </Button>
      </div>

      <div className="glass overflow-hidden rounded-glass">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[132px]">Video</TableHead>
              <TableHead>Názov</TableHead>
              <TableHead>Vydané</TableHead>
              <TableHead className="text-right">Dĺžka</TableHead>
              <TableHead>Na webe</TableHead>
              <TableHead className="text-right">Akcie</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {videos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-white/50">
                  {filter === 'missing' ? 'Všetky videá z kanála sú na webe. 🎉' : 'Kanál nemá žiadne verejné videá.'}
                </TableCell>
              </TableRow>
            ) : (
              videos.map((video) => (
                <TableRow key={video.id}>
                  <TableCell>
                    <a href={`https://youtu.be/${video.id}`} target="_blank" rel="noreferrer" className="block h-[68px] w-[120px] overflow-hidden rounded-md bg-surface">
                      {video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
                    </a>
                  </TableCell>
                  <TableCell className="max-w-sm whitespace-normal">
                    <a href={`https://youtu.be/${video.id}`} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 font-medium text-white hover:underline">
                      {video.title}
                      <ExternalLink className="mt-0.5 size-3 shrink-0 opacity-50" aria-hidden="true" />
                    </a>
                    <div className="mt-1 text-xs text-white/40">
                      {video.channelTitle}
                      {video.languages.length ? ` · texty: ${video.languages.join(', ').toUpperCase()}` : ''}
                      {video.viewCount !== null ? ` · ${video.viewCount.toLocaleString('sk')} zhliadnutí` : ''}
                    </div>
                  </TableCell>
                  <TableCell className="text-white/70">{DATE_FORMATTER.format(new Date(video.publishedAt))}</TableCell>
                  <TableCell className="text-right tabular-nums text-white/70">{formatDuration(video.durationSeconds)}</TableCell>
                  <TableCell>
                    {video.post ? (
                      <Badge variant="outline" className={STATUS_BADGE_CLASS[video.post.status]}>
                        {STATUS_LABEL[video.post.status]}
                      </Badge>
                    ) : (
                      <span className="text-sm text-white/40">Chýba</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {video.post ? (
                      <Link href={`/admin/posts/${video.post.id}/edit`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                        Upraviť
                      </Link>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" disabled={pendingId !== null} onClick={() => handleImport(video, 'draft')}>
                          Ako koncept
                        </Button>
                        <Button size="sm" disabled={pendingId !== null} onClick={() => handleImport(video, 'published')}>
                          {pendingId === video.id ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
                          Uverejniť
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
