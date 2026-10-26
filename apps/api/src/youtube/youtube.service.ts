import type { Db } from '@carnaby/db';
import { categories, posts } from '@carnaby/db';
import {
  LANGUAGES,
  mergeYoutubeTranslations,
  slugify,
  type Language,
  type PostUpsertInput,
  type YoutubeTranslations,
} from '@carnaby/shared';
import { TRPCError } from '@trpc/server';
import { eq, inArray } from 'drizzle-orm';
import { getPostById, upsertPost } from '../posts/posts.admin';
import type { PostStatus } from '../posts/posts.read';
import { fetchYoutubeThumbnail } from '../uploads/uploads.service';
import {
  parseChannelConfig,
  YoutubeClient,
  YoutubeNotConfiguredError,
  type YoutubeChannel,
  type YoutubeChannelConfig,
  type YoutubeVideo,
} from './youtube.client';

const CACHE_TTL_MS = 10 * 60 * 1000;

export interface YoutubeSettings {
  apiKey: string | undefined;
  channels: YoutubeChannelConfig[];
}

export function youtubeSettings(env: Record<string, string | undefined> = process.env): YoutubeSettings {
  return { apiKey: env['YOUTUBE_API_KEY'] || undefined, channels: parseChannelConfig(env['YOUTUBE_CHANNELS']) };
}

function client(settings: YoutubeSettings): YoutubeClient {
  if (!settings.apiKey) throw new YoutubeNotConfiguredError('YOUTUBE_API_KEY is not set');
  return new YoutubeClient(settings.apiKey);
}

// Channel listings cost API quota and change rarely; the admin's "refresh" bypasses this.
const channelCache = new Map<string, { at: number; channel: YoutubeChannel; videos: YoutubeVideo[] }>();

async function loadChannel(settings: YoutubeSettings, ref: string, refresh: boolean) {
  const cached = channelCache.get(ref);
  if (!refresh && cached && Date.now() - cached.at < CACHE_TTL_MS) return cached;
  const yt = client(settings);
  const channel = await yt.resolveChannel(ref);
  const videos = await yt.getVideos(await yt.listUploadIds(channel.uploadsPlaylistId));
  const entry = { at: Date.now(), channel, videos };
  channelCache.set(ref, entry);
  return entry;
}

export function clearYoutubeCache(): void {
  channelCache.clear();
}

export interface LinkedPost {
  id: number;
  slug: string;
  status: PostStatus;
}

/** Posts that embed any of `videoIds`, keyed by video id (a published post wins over others). */
async function postsByVideo(db: Db, videoIds: string[]): Promise<Map<string, LinkedPost>> {
  const map = new Map<string, LinkedPost>();
  if (videoIds.length === 0) return map;
  const rows = await db.select({ id: posts.id, slug: posts.slug, status: posts.status, youtubeId: posts.youtubeId })
    .from(posts).where(inArray(posts.youtubeId, videoIds));
  for (const row of rows) {
    if (!row.youtubeId) continue;
    const current = map.get(row.youtubeId);
    if (!current || (current.status !== 'published' && row.status === 'published')) {
      map.set(row.youtubeId, { id: row.id, slug: row.slug, status: row.status });
    }
  }
  return map;
}

export interface OverviewVideo {
  id: string;
  title: string;
  publishedAt: string;
  durationSeconds: number;
  thumbnailUrl: string | null;
  viewCount: number | null;
  channelTitle: string;
  category: string | null;
  languages: Language[];
  post: LinkedPost | null;
}

export interface YoutubeOverview {
  configured: boolean;
  missing: string[];
  channels: { ref: string; title: string | null; category: string | null; videoCount: number; error: string | null }[];
  videos: OverviewVideo[];
}

/** Every public video of the configured channels, newest first, with the post (if any) that
 * already embeds it. */
export async function youtubeOverview(db: Db, opts: { refresh?: boolean } = {}, settings = youtubeSettings()): Promise<YoutubeOverview> {
  const missing = [!settings.apiKey && 'YOUTUBE_API_KEY', settings.channels.length === 0 && 'YOUTUBE_CHANNELS'].filter(
    (m): m is string => Boolean(m),
  );
  if (missing.length) return { configured: false, missing, channels: [], videos: [] };

  const channels: YoutubeOverview['channels'] = [];
  const videos: Omit<OverviewVideo, 'post'>[] = [];
  for (const config of settings.channels) {
    try {
      const { channel, videos: channelVideos } = await loadChannel(settings, config.ref, Boolean(opts.refresh));
      channels.push({ ref: config.ref, title: channel.title, category: config.category ?? null, videoCount: channelVideos.length, error: null });
      for (const v of channelVideos) {
        videos.push({
          id: v.id,
          title: v.title,
          publishedAt: v.publishedAt,
          durationSeconds: v.durationSeconds,
          thumbnailUrl: v.thumbnailUrl,
          viewCount: v.viewCount,
          channelTitle: v.channelTitle,
          category: config.category ?? null,
          languages: LANGUAGES.filter((l) => v.translations.byLanguage[l]),
        });
      }
    } catch (error) {
      channels.push({ ref: config.ref, title: null, category: config.category ?? null, videoCount: 0, error: error instanceof Error ? error.message : String(error) });
    }
  }

  const linked = await postsByVideo(db, videos.map((v) => v.id));
  return {
    configured: true,
    missing: [],
    channels,
    videos: videos
      .map((v) => ({ ...v, post: linked.get(v.id) ?? null }))
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
  };
}

export interface YoutubePreview {
  videoId: string;
  channelId: string;
  title: string;
  publishedAt: string;
  translations: YoutubeTranslations;
  /** Stored still (`yt-<id>.jpg`), or null when the download failed -- the site then falls back
   * to YouTube's own thumbnail URL. */
  thumbnail: string | null;
  thumbnailError: string | null;
}

/** Fetches a video and stores its best still. Writes nothing to the database. */
export async function previewYoutubeVideo(videoId: string, settings = youtubeSettings()): Promise<YoutubePreview> {
  const video = await client(settings).getVideo(videoId);
  let thumbnail: string | null = null;
  let thumbnailError: string | null = null;
  try {
    thumbnail = await fetchYoutubeThumbnail(videoId);
  } catch (error) {
    thumbnailError = error instanceof Error ? error.message : String(error);
  }
  return { videoId, channelId: video.channelId, title: video.title, publishedAt: video.publishedAt, translations: video.translations, thumbnail, thumbnailError };
}

async function availableSlug(db: Db, wanted: string): Promise<string> {
  const base = wanted || 'video';
  for (let n = 1; ; n += 1) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const [taken] = await db.select({ id: posts.id }).from(posts).where(eq(posts.slug, candidate)).limit(1);
    if (!taken) return candidate;
  }
}

/** Category of the configured channel the video belongs to (resolved through the cache). */
async function categoryIdsForChannel(db: Db, channelId: string, settings: YoutubeSettings): Promise<number[]> {
  for (const config of settings.channels) {
    if (!config.category) continue;
    try {
      const { channel } = await loadChannel(settings, config.ref, false);
      if (channel.id !== channelId) continue;
      const [category] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, config.category)).limit(1);
      return category ? [category.id] : [];
    } catch {
      // an unreachable channel just means no automatic category
    }
  }
  return [];
}

/** Creates a post from a video: texts in both languages, release date, still and category. */
export async function importYoutubeVideo(
  db: Db,
  videoId: string,
  status: PostStatus,
  authorId: string | null,
  settings = youtubeSettings(),
): Promise<{ id: number; slug: string; thumbnailError: string | null }> {
  const existing = (await postsByVideo(db, [videoId])).get(videoId);
  if (existing) {
    throw new TRPCError({ code: 'CONFLICT', message: `video is already on the site as post ${existing.id} (${existing.slug})` });
  }
  const preview = await previewYoutubeVideo(videoId, settings);
  const translations = mergeYoutubeTranslations(preview.translations, {});
  const input: PostUpsertInput = {
    slug: await availableSlug(db, slugify(translations.sk.title)),
    status,
    isFeatured: false,
    youtubeId: videoId,
    thumbnailPath: preview.thumbnail ?? undefined,
    categoryIds: await categoryIdsForChannel(db, preview.channelId, settings),
    publishedAt: preview.publishedAt,
    translations,
  };
  const { id } = await upsertPost(db, input, authorId);
  return { id, slug: input.slug, thumbnailError: preview.thumbnailError };
}

/** Refreshes an existing post from its video: texts (keeping translations YouTube doesn't
 * have), release date and still. Slug, status, categories and links are left alone. */
export async function syncPostFromYoutube(
  db: Db,
  postId: number,
  authorId: string | null,
  settings = youtubeSettings(),
): Promise<{ id: number; thumbnailError: string | null }> {
  const current = await getPostById(db, postId);
  if (!current.post.youtubeId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'post has no YouTube video' });
  const preview = await previewYoutubeVideo(current.post.youtubeId, settings);
  const translations = mergeYoutubeTranslations(preview.translations, current.translations);
  await upsertPost(db, {
    id: postId,
    slug: current.post.slug,
    status: current.post.status,
    isFeatured: current.post.isFeatured,
    youtubeId: current.post.youtubeId,
    soundcloudUrl: current.post.soundcloudUrl ?? undefined,
    thumbnailPath: preview.thumbnail ?? current.post.thumbnailPath ?? undefined,
    categoryIds: current.categoryIds,
    publishedAt: preview.publishedAt,
    translations,
  }, authorId);
  return { id: postId, thumbnailError: preview.thumbnailError };
}
