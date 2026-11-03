'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CirclePlay, Eye, FileClock, Languages, Plus, Send, Archive } from 'lucide-react';

import { useTRPC } from '../../lib/trpc-react';
import { PostImage } from '../post/post-image';
import { buttonVariants } from '../ui/button';
import { STATUS_DOT_CLASS } from './status';

function StatCard({
  href,
  label,
  value,
  icon: Icon,
  tone,
  hint,
}: {
  href: string;
  label: string;
  value: number | undefined;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  hint?: string;
}) {
  return (
    <Link href={href} className="glass group flex flex-col gap-3 rounded-glass p-4 transition-colors hover:bg-white/[0.06] lg:p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-white/50">{label}</span>
        <Icon className={`size-4 ${tone}`} />
      </div>
      <span className="font-display text-3xl font-semibold tabular-nums text-white">{value ?? '–'}</span>
      {hint ? <span className="text-xs text-white/40 group-hover:text-white/60">{hint}</span> : null}
    </Link>
  );
}

/** `/admin`: what needs attention (drafts, missing translations), what performs, quick actions. */
export function Dashboard({ name }: { name: string }) {
  const trpc = useTRPC();
  const stats = useQuery(trpc.posts.adminStats.queryOptions());
  const s = stats.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-white lg:text-3xl">Ahoj, {name.split(' ')[0]}</h1>
          <p className="mt-1 text-sm text-white/55">
            {s ? `${s.total} príspevkov · ${s.totalViews.toLocaleString('sk')} zobrazení spolu` : 'Načítavam…'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/youtube" className={buttonVariants({ variant: 'outline' })}>
            <CirclePlay aria-hidden="true" />
            YouTube
          </Link>
          <Link href="/admin/posts/new" className={buttonVariants()}>
            <Plus aria-hidden="true" />
            Nový
          </Link>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4" aria-label="Štatistiky">
        <StatCard href="/admin/posts?status=published" label="Publikované" value={s?.byStatus.published} icon={Send} tone="text-devlog" />
        <StatCard href="/admin/posts?status=draft" label="Koncepty" value={s?.byStatus.draft} icon={FileClock} tone="text-dodo" />
        <StatCard
          href="/admin/posts?status=published&missing=en"
          label="Bez EN"
          value={s?.publishedMissing.en}
          icon={Languages}
          tone="text-carnaby"
          hint={s?.publishedMissing.en ? 'Publikované bez anglickej verzie →' : undefined}
        />
        <StatCard href="/admin/posts?status=archived" label="Archív" value={s?.byStatus.archived} icon={Archive} tone="text-white/50" />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="glass rounded-glass p-4 lg:p-5">
          <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-white">
            <Eye className="size-4 text-white/50" aria-hidden="true" />
            Najčítanejšie
          </h2>
          <PostList posts={s?.mostViewed} empty="Zatiaľ žiadne zobrazenia." showViews />
        </section>
        <section className="glass rounded-glass p-4 lg:p-5">
          <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-white">
            <FileClock className="size-4 text-white/50" aria-hidden="true" />
            Rozpracované koncepty
          </h2>
          <PostList posts={s?.recentDrafts} empty="Žiadne koncepty — všetko je vonku." />
        </section>
      </div>

      <p className="text-center text-xs text-white/35">
        Návštevnosť podrobne:{' '}
        <a href="https://analytics.carnaby.sk" target="_blank" rel="noreferrer" className="underline-offset-2 hover:text-white hover:underline">
          analytics.carnaby.sk
        </a>
      </p>
    </div>
  );
}

type Brief = { id: number; slug: string; title: string; status: 'draft' | 'published' | 'archived'; viewCount: number; thumbnailPath: string | null; youtubeId: string | null };

function PostList({ posts, empty, showViews }: { posts: Brief[] | undefined; empty: string; showViews?: boolean }) {
  if (!posts) return <div className="h-40 animate-pulse rounded-lg bg-white/[0.03]" />;
  if (posts.length === 0) return <p className="py-6 text-center text-sm text-white/40">{empty}</p>;
  return (
    <ul className="-mx-2 flex flex-col">
      {posts.map((p) => (
        <li key={p.id}>
          <Link href={`/admin/posts/${p.id}/edit`} className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white/5">
            <div className="size-10 shrink-0 overflow-hidden rounded-md bg-surface">
              <PostImage post={{ ...p, categories: [] }} width={300} />
            </div>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-1 text-sm font-medium text-white">{p.title || '(bez názvu)'}</span>
              <span className="mt-0.5 flex items-center gap-1.5 text-xs text-white/40">
                <span className={`size-1.5 rounded-full ${STATUS_DOT_CLASS[p.status]}`} />
                {p.slug}
              </span>
            </span>
            {showViews ? <span className="shrink-0 text-sm tabular-nums text-white/60">{p.viewCount}</span> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
