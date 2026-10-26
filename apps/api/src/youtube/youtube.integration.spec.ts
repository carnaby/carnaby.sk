import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { eq } from 'drizzle-orm';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { categories, createDb, posts, user } from '@carnaby/db';
import { getPostById, upsertPost } from '../posts/posts.admin';
import { clearYoutubeCache, importYoutubeVideo, syncPostFromYoutube, youtubeOverview, type YoutubeSettings } from './youtube.service';

const url = process.env['TEST_DATABASE_URL'];
const d = url ? describe : describe.skip;

/** Minimal fake of the YouTube Data API v3 + img.youtube.com, keyed on the request URL. */
function fakeYoutube(videos: Record<string, { title: string; description: string; lang?: string; en?: { title: string; description: string }; publishedAt: string }>) {
  return vi.fn(async (input: string | URL) => {
    const u = new URL(String(input));
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    if (u.hostname === 'img.youtube.com') return new Response(new Uint8Array([0xff, 0xd8, 0xff]), { status: 200 });
    if (u.searchParams.get('key') !== 'test-key') return json({ error: { message: 'API key not valid', errors: [{ reason: 'keyInvalid' }] } }, 400);
    if (u.pathname.endsWith('/channels')) {
      return json({ items: [{ id: 'UCfake', snippet: { title: 'Carnaby' }, contentDetails: { relatedPlaylists: { uploads: 'UUfake' } } }] });
    }
    if (u.pathname.endsWith('/playlistItems')) {
      return json({ items: Object.keys(videos).map((videoId) => ({ contentDetails: { videoId } })) });
    }
    if (u.pathname.endsWith('/videos')) {
      const ids = (u.searchParams.get('id') ?? '').split(',');
      return json({
        items: ids.filter((id) => videos[id]).map((id) => {
          const v = videos[id]!;
          return {
            id,
            snippet: { channelId: 'UCfake', channelTitle: 'Carnaby', title: v.title, description: v.description, publishedAt: v.publishedAt, defaultLanguage: v.lang, thumbnails: { medium: { url: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` } } },
            contentDetails: { duration: 'PT3M30S' },
            statistics: { viewCount: '42' },
            ...(v.en ? { localizations: { en: v.en } } : {}),
          };
        }),
      });
    }
    return json({ error: { message: 'unexpected' } }, 404);
  });
}

d('YouTube sync', () => {
  const { db, pool } = createDb(url!);
  const runId = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const authorId = randomBytes(16).toString('hex');
  const categorySlug = `yt-${runId}`;
  const vid = (n: number) => `v${runId.slice(-6)}${n}`.slice(0, 11).padEnd(11, 'x');
  const settings: YoutubeSettings = { apiKey: 'test-key', channels: [{ ref: '@carnaby', category: categorySlug }] };
  let uploadsDir: string;

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: __dirname + '/../../../../packages/db/migrations' });
    await db.insert(user).values({ id: authorId, email: `yt-${runId}@a.sk`, name: 'YT' });
    await db.insert(categories).values({ slug: categorySlug, name: 'YT test' });
    uploadsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'carnaby-yt-'));
    process.env['UPLOADS_DIR'] = uploadsDir;
    process.env['CACHE_DIR'] = path.join(uploadsDir, 'cache');
    vi.stubGlobal('fetch', fakeYoutube({
      [vid(1)]: { title: 'Nočná jazda', description: 'Synthpopová jazda nocou, nová pesnička.\n\n#carnaby', lang: 'sk', publishedAt: '2026-03-01T18:00:00Z' },
      [vid(2)]: { title: 'Ranná káva', description: 'Pesnička o rannej káve a dobrej nálade.', lang: 'sk', en: { title: 'Morning Coffee', description: 'A song about morning coffee and a good mood.' }, publishedAt: '2026-04-01T18:00:00Z' },
    }));
  });
  afterEach(() => clearYoutubeCache());
  afterAll(async () => {
    vi.unstubAllGlobals();
    await pool.end();
    await fs.rm(uploadsDir, { recursive: true, force: true });
  });

  it('reports missing configuration instead of calling YouTube', async () => {
    const overview = await youtubeOverview(db, {}, { apiKey: undefined, channels: [] });
    expect(overview).toMatchObject({ configured: false, missing: ['YOUTUBE_API_KEY', 'YOUTUBE_CHANNELS'] });
  });

  it('surfaces a channel-level API error without failing the whole overview', async () => {
    const overview = await youtubeOverview(db, {}, { apiKey: 'wrong', channels: [{ ref: '@carnaby' }] });
    expect(overview.channels[0]!.error).toMatch(/keyInvalid/);
    expect(overview.videos).toEqual([]);
  });

  it('imports a single-language video into both languages with release date, still and channel category', async () => {
    const result = await importYoutubeVideo(db, vid(1), 'published', authorId, settings);
    const post = await getPostById(db, result.id);
    expect(post.post).toMatchObject({ status: 'published', youtubeId: vid(1), thumbnailPath: `yt-${vid(1)}.jpg`, publishedAt: '2026-03-01T18:00:00.000Z' });
    expect(post.translations.sk?.title).toBe('Nočná jazda');
    expect(post.translations.en?.title).toBe('Nočná jazda');
    expect(post.translations.sk?.content).toBe('Synthpopová jazda nocou, nová pesnička.\n\n\\#carnaby');
    expect(post.translations.sk?.excerpt).toBe('Synthpopová jazda nocou, nová pesnička.');
    const [cat] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, categorySlug));
    expect(post.categoryIds).toEqual([cat!.id]);
    await expect(fs.access(path.join(uploadsDir, 'originals', `yt-${vid(1)}.jpg`))).resolves.toBeUndefined();
  });

  it('refuses to import the same video twice', async () => {
    await expect(importYoutubeVideo(db, vid(1), 'draft', authorId, settings)).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('uses YouTube localizations and picks a free slug', async () => {
    await upsertPost(db, { slug: 'ranna-kava', status: 'draft', isFeatured: false, categoryIds: [], translations: { sk: { title: 'x', content: 'y' } } }, authorId)
      .catch(() => undefined); // may already exist from an earlier run
    const result = await importYoutubeVideo(db, vid(2), 'draft', authorId, settings);
    expect(result.slug).toMatch(/^ranna-kava-\d+$/);
    const post = await getPostById(db, result.id);
    expect(post.translations.en?.title).toBe('Morning Coffee');
  });

  it('lists every channel video with the post that embeds it', async () => {
    const overview = await youtubeOverview(db, {}, settings);
    expect(overview.channels).toEqual([{ ref: '@carnaby', title: 'Carnaby', category: categorySlug, videoCount: 2, error: null }]);
    expect(overview.videos.map((v) => v.id)).toEqual([vid(2), vid(1)]);
    expect(overview.videos[1]).toMatchObject({ durationSeconds: 210, viewCount: 42, languages: ['sk'], post: { status: 'published' } });
  });

  it('sync refreshes YouTube texts but keeps a translation YouTube does not have', async () => {
    const [row] = await db.select({ id: posts.id }).from(posts).where(eq(posts.youtubeId, vid(1)));
    const current = await getPostById(db, row!.id);
    await upsertPost(db, {
      id: row!.id, slug: current.post.slug, status: current.post.status, isFeatured: current.post.isFeatured,
      youtubeId: vid(1), thumbnailPath: current.post.thumbnailPath ?? undefined, categoryIds: current.categoryIds,
      translations: { sk: { title: 'Stará verzia', content: 'stará' }, en: { title: 'Night Drive', content: 'translated on the web' } },
    }, authorId);

    await syncPostFromYoutube(db, row!.id, authorId, settings);
    const after = await getPostById(db, row!.id);
    expect(after.translations.sk?.title).toBe('Nočná jazda');
    expect(after.translations.en).toMatchObject({ title: 'Night Drive', content: 'translated on the web' });
    expect(after.post.status).toBe('published');
  });
});
