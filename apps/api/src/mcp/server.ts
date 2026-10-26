import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Db } from '@carnaby/db';
import { categories, posts, user } from '@carnaby/db';
import { LANGUAGES, postUpsertInput, slugify, type Language, type PostUpsertInput, type TranslationInput } from '@carnaby/shared';
import { TRPCError } from '@trpc/server';
import { asc, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { appUrl } from '../auth/auth';
import { adminListPosts, getPostById, removePost, upsertPost, type PostById } from '../posts/posts.admin';
import {
  fetchYoutubeThumbnail,
  IMAGE_WIDTHS,
  InvalidImageError,
  saveImageBuffer,
  saveImageFromUrl,
  UpstreamNotFoundError,
  UpstreamUnavailableError,
  uploadExists,
} from '../uploads/uploads.service';
import { YoutubeApiError, YoutubeNotConfiguredError, YoutubeVideoNotFoundError } from '../youtube/youtube.client';
import { importYoutubeVideo, syncPostFromYoutube, youtubeOverview } from '../youtube/youtube.service';
import type { McpActor } from './mcp-auth';

const STATUSES = ['draft', 'published', 'archived'] as const;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,20}$/;

const INSTRUCTIONS = `
Content management for carnaby.sk -- Jozef's personal site (music, dev log). You act as its admin.

Model:
- A post has one slug (URL: /posts/<slug> for Slovak, /en/posts/<slug> for English), a status
  (draft | published | archived), categories, optional YouTube video, SoundCloud link and thumbnail,
  and up to two translations: "sk" (default language, shown at /) and "en". At least one is required.
- Only "published" posts are public. "archived" hides a post without deleting it. Create posts as
  drafts unless the user explicitly asks to publish.
- Categories (use their slugs): devlog = tech, coding, AI experiments, making-of this site;
  dodo = acoustic folk, storyteller ballads, southern rock; carnaby = retro synth-pop, euro-disco.
- "featured" posts appear in the homepage hero grid.

Content:
- Post content is GitHub-flavoured Markdown rendered as sanitized HTML. Do not repeat the title as
  an H1 in the content -- the page already renders it. Use ## and lower headings.
- excerpt = 1-2 sentence teaser for cards; metaDescription = SEO description (<= 160 chars).
- youtubeId (e.g. dQw4w9WgXcQ, not a full URL) embeds the video above the content and is the
  thumbnail fallback; soundcloudUrl renders a "listen on SoundCloud" button.
- Images: upload with upload_image (from a URL or base64), then put the returned markdown into the
  content, or pass the filename as "thumbnail". set_thumbnail_from_youtube fetches the video still.
- YouTube: youtube_overview compares the channel's videos with the site; import_youtube_video
  creates a post from a video (both languages get YouTube's text when the video has only one --
  translate the other one afterwards with update_post); sync_post_from_youtube refreshes a post.
- Slugs: lowercase a-z, 0-9 and hyphens. If omitted on create, it is derived from the SK title
  (or EN when there is no SK). Changing the slug of a published post breaks existing links.

Always call get_post before update_post when you have not seen the current content in this
conversation, and show the user what you are about to delete before calling delete_post.
`.trim();

const translationShape = {
  title: z.string().min(1),
  content: z.string().min(1).describe('Markdown body'),
  excerpt: z.string().optional().describe('Short teaser for post cards'),
  metaDescription: z.string().optional().describe('SEO description, max ~160 characters'),
};
const translationInputSchema = z.object(translationShape);
const translationPatchSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  excerpt: z.string().nullable().optional().describe('null clears it'),
  metaDescription: z.string().nullable().optional().describe('null clears it'),
});

class ToolError extends Error {}

function json(value: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

function toolError(message: string): CallToolResult {
  return { isError: true, content: [{ type: 'text', text: message }] };
}

/** Maps every expected failure to a readable tool error (the model can then fix its call);
 * unexpected ones are logged and reported generically. */
async function run(fn: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await fn();
  } catch (error) {
    if (
      error instanceof ToolError || error instanceof InvalidImageError || error instanceof UpstreamNotFoundError ||
      error instanceof YoutubeNotConfiguredError || error instanceof YoutubeVideoNotFoundError || error instanceof YoutubeApiError
    ) {
      return toolError(error.message);
    }
    if (error instanceof UpstreamUnavailableError) return toolError(`Download failed: ${error.message}`);
    if (error instanceof TRPCError) {
      if (error.code === 'NOT_FOUND') return toolError('Post not found.');
      if (error.code === 'CONFLICT') return toolError(`${error.message} -- choose a different slug.`);
      return toolError(error.message);
    }
    console.error('MCP tool failed:', error);
    return toolError('Internal error while running the tool (details are in the server log).');
  }
}

function publicUrls(slug: string) {
  const base = appUrl();
  return { sk: `${base}/posts/${slug}`, en: `${base}/en/posts/${slug}` };
}

function imageInfo(filename: string) {
  const base = appUrl();
  return {
    filename,
    urls: Object.fromEntries(IMAGE_WIDTHS.map((w) => [w, `${base}/images/${w}/${filename}`])),
    markdown: `![](/images/1200/${filename})`,
  };
}

async function categoryMaps(db: Db) {
  const rows = await db.select({ id: categories.id, slug: categories.slug, name: categories.name })
    .from(categories).orderBy(asc(categories.sortOrder));
  return {
    rows,
    slugById: new Map(rows.map((c) => [c.id, c.slug])),
    idBySlug: new Map(rows.map((c) => [c.slug, c.id])),
  };
}

function resolveCategoryIds(slugs: string[], idBySlug: Map<string, number>): number[] {
  const ids: number[] = [];
  const unknown: string[] = [];
  for (const slug of slugs) {
    const id = idBySlug.get(slug);
    if (id === undefined) unknown.push(slug);
    else ids.push(id);
  }
  if (unknown.length) {
    throw new ToolError(`Unknown category: ${unknown.join(', ')}. Valid: ${[...idBySlug.keys()].join(', ')}.`);
  }
  return ids;
}

async function findPostId(db: Db, ref: { id?: number; slug?: string }): Promise<number> {
  if (ref.id !== undefined) return ref.id;
  if (!ref.slug) throw new ToolError('Pass either id or slug.');
  const [row] = await db.select({ id: posts.id }).from(posts).where(eq(posts.slug, ref.slug)).limit(1);
  if (!row) throw new ToolError(`No post with slug "${ref.slug}".`);
  return row.id;
}

async function postDetail(db: Db, id: number) {
  const data = await getPostById(db, id);
  const { slugById } = await categoryMaps(db);
  const [meta] = await db.select({ createdAt: posts.createdAt, updatedAt: posts.updatedAt }).from(posts).where(eq(posts.id, id));
  return {
    id: data.post.id,
    slug: data.post.slug,
    status: data.post.status,
    isFeatured: data.post.isFeatured,
    categories: data.categoryIds.map((cid) => slugById.get(cid)).filter(Boolean),
    youtubeId: data.post.youtubeId,
    soundcloudUrl: data.post.soundcloudUrl,
    thumbnail: data.post.thumbnailPath ? imageInfo(data.post.thumbnailPath) : null,
    viewCount: data.post.viewCount,
    publishedAt: data.post.publishedAt,
    createdAt: meta?.createdAt.toISOString(),
    updatedAt: meta?.updatedAt.toISOString(),
    translations: data.translations,
    publicUrls: data.post.status === 'published' ? publicUrls(data.post.slug) : null,
    adminUrl: `${appUrl()}/admin/posts/${data.post.id}/edit`,
  };
}

/** Final validation through the same contract the admin UI uses, with readable messages. */
function validateUpsert(candidate: unknown): PostUpsertInput {
  const parsed = postUpsertInput.safeParse(candidate);
  if (!parsed.success) {
    throw new ToolError(`Invalid post: ${parsed.error.issues.map((i) => `${i.path.join('.') || 'post'}: ${i.message}`).join('; ')}`);
  }
  return parsed.data;
}

function normalizeYoutubeId(value: string | null | undefined): string | undefined {
  if (value == null || value.trim() === '') return undefined;
  const raw = value.trim();
  // Accept full URLs too -- youtube.com/watch?v=ID, youtu.be/ID, /shorts/ID, /embed/ID.
  const fromUrl = raw.match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/)([A-Za-z0-9_-]{6,20})/)?.[1];
  const id = fromUrl ?? raw;
  if (!YOUTUBE_ID.test(id)) throw new ToolError(`"${value}" is not a valid YouTube video id.`);
  return id;
}

function cleanTranslation(t: TranslationInput): TranslationInput {
  return {
    title: t.title.trim(),
    content: t.content,
    excerpt: t.excerpt?.trim() || undefined,
    metaDescription: t.metaDescription?.trim() || undefined,
  };
}

/** The stored post in `postUpsertInput` shape -- the base every partial change is applied to. */
function currentAsInput(current: PostById): PostUpsertInput {
  const translations: PostUpsertInput['translations'] = {};
  for (const lang of LANGUAGES) {
    const t = current.translations[lang];
    if (t) translations[lang] = t;
  }
  return {
    slug: current.post.slug,
    status: current.post.status,
    isFeatured: current.post.isFeatured,
    youtubeId: current.post.youtubeId ?? undefined,
    soundcloudUrl: current.post.soundcloudUrl ?? undefined,
    thumbnailPath: current.post.thumbnailPath ?? undefined,
    categoryIds: current.categoryIds,
    translations,
  };
}

/** Patch semantics for optional string fields: undefined keeps the current value, null or a
 * blank string clears it, anything else replaces it. */
function patchField(next: string | null | undefined, current: string | undefined): string | undefined {
  if (next === undefined) return current;
  return next?.trim() || undefined;
}

async function assertThumbnailExists(filename: string | undefined, previous?: string): Promise<void> {
  if (!filename || filename === previous) return;
  if (!(await uploadExists(filename))) {
    throw new ToolError(`Thumbnail "${filename}" does not exist -- upload it with upload_image first and pass the returned filename.`);
  }
}

async function saveChanges(db: Db, id: number, changes: Partial<PostUpsertInput>, actor: McpActor): Promise<void> {
  const current = await getPostById(db, id);
  const input = validateUpsert({ ...currentAsInput(current), ...changes });
  await upsertPost(db, { ...input, id }, actor.userId);
}

export function createCarnabyMcpServer(db: Db, actor: McpActor): McpServer {
  const server = new McpServer({ name: 'carnaby.sk', version: '1.0.0' }, { instructions: INSTRUCTIONS });

  server.registerTool('site_overview', {
    title: 'Site overview',
    description: 'Counts of posts by status and category, missing translations, most viewed posts and recent drafts.',
    annotations: { readOnlyHint: true },
  }, () => run(async () => {
    const all = await adminListPosts(db, { page: 1, limit: 100_000, sortBy: 'createdAt', order: 'desc' });
    const items = all.items;
    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, items.filter((p) => p.status === s).length]));
    const byCategory: Record<string, number> = {};
    for (const p of items) for (const c of p.categories) byCategory[c.slug] = (byCategory[c.slug] ?? 0) + 1;
    const brief = (p: (typeof items)[number]) => ({ id: p.id, slug: p.slug, title: p.title, status: p.status });
    return json({
      totalPosts: all.total,
      byStatus,
      byCategory,
      publishedMissingEnglish: items.filter((p) => p.status === 'published' && !p.hasEn).map(brief),
      publishedMissingSlovak: items.filter((p) => p.status === 'published' && !p.hasSk).map(brief),
      mostViewed: [...items].sort((a, b) => b.viewCount - a.viewCount).slice(0, 10)
        .map((p) => ({ ...brief(p), viewCount: p.viewCount })),
      recentDrafts: items.filter((p) => p.status === 'draft').slice(0, 10).map(brief),
      analytics: 'Visitor analytics live in Umami: https://analytics.carnaby.sk',
    });
  }));

  server.registerTool('list_posts', {
    title: 'List posts',
    description: 'Lists posts of any status (admin view) with filters, search and sorting. Returns ids, slugs, titles, status, languages and view counts -- use get_post for full content.',
    inputSchema: {
      status: z.enum(STATUSES).optional(),
      category: z.string().optional().describe('Category slug: devlog | dodo | carnaby'),
      featured: z.boolean().optional(),
      search: z.string().optional().describe('Substring of the slug or a title'),
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(20),
      sortBy: z.enum(['createdAt', 'publishedAt', 'title', 'status', 'viewCount']).default('createdAt'),
      order: z.enum(['asc', 'desc']).default('desc'),
    },
    annotations: { readOnlyHint: true },
  }, (args) => run(async () => {
    const result = await adminListPosts(db, args);
    return json({
      ...result,
      items: result.items.map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        status: p.status,
        isFeatured: p.isFeatured,
        categories: p.categories.map((c) => c.slug),
        languages: [p.hasSk && 'sk', p.hasEn && 'en'].filter(Boolean),
        thumbnail: p.thumbnailPath,
        youtubeId: p.youtubeId,
        viewCount: p.viewCount,
        publishedAt: p.publishedAt,
        createdAt: p.createdAt,
      })),
    });
  }));

  server.registerTool('get_post', {
    title: 'Get post',
    description: 'Full post by id or slug: both translations with complete markdown, categories, media, status and URLs.',
    inputSchema: { id: z.number().int().optional(), slug: z.string().optional() },
    annotations: { readOnlyHint: true },
  }, (args) => run(async () => json(await postDetail(db, await findPostId(db, args)))));

  server.registerTool('create_post', {
    title: 'Create post',
    description: 'Creates a post. Defaults to a draft. Provide at least one translation (sk and/or en).',
    inputSchema: {
      translations: z.object({ sk: translationInputSchema.optional(), en: translationInputSchema.optional() }),
      slug: z.string().optional().describe('Defaults to a slug of the SK (or EN) title'),
      status: z.enum(STATUSES).default('draft'),
      categories: z.array(z.string()).default([]).describe('Category slugs'),
      isFeatured: z.boolean().default(false),
      youtubeId: z.string().optional().describe('Video id or YouTube URL'),
      soundcloudUrl: z.string().optional(),
      thumbnail: z.string().optional().describe('Filename returned by upload_image'),
    },
  }, (args) => run(async () => {
    const { idBySlug } = await categoryMaps(db);
    const translations: PostUpsertInput['translations'] = {};
    for (const lang of LANGUAGES) {
      const t = args.translations[lang];
      if (t) translations[lang] = cleanTranslation(t);
    }
    const slug = args.slug?.trim() || slugify(translations.sk?.title ?? translations.en?.title ?? '');
    const input = validateUpsert({
      slug,
      status: args.status,
      isFeatured: args.isFeatured,
      youtubeId: normalizeYoutubeId(args.youtubeId),
      soundcloudUrl: args.soundcloudUrl?.trim() || undefined,
      thumbnailPath: args.thumbnail?.trim() || undefined,
      categoryIds: resolveCategoryIds(args.categories, idBySlug),
      translations,
    });
    await assertThumbnailExists(input.thumbnailPath);
    const { id } = await upsertPost(db, input, actor.userId);
    return json({ created: true, post: await postDetail(db, id) });
  }));

  server.registerTool('update_post', {
    title: 'Update post',
    description: 'Partially updates a post: only the fields you pass change. For a translation, pass only the fields to change (it is merged with the stored one); pass null to remove a whole language version. Pass null for youtubeId/soundcloudUrl/thumbnail to clear them.',
    inputSchema: {
      id: z.number().int(),
      slug: z.string().optional(),
      status: z.enum(STATUSES).optional(),
      categories: z.array(z.string()).optional().describe('Replaces the category list'),
      isFeatured: z.boolean().optional(),
      youtubeId: z.string().nullable().optional(),
      soundcloudUrl: z.string().nullable().optional(),
      thumbnail: z.string().nullable().optional(),
      publishedAt: z.string().datetime({ offset: true }).optional().describe('ISO date-time, e.g. 2026-03-01T18:00:00Z'),
      translations: z.object({
        sk: translationPatchSchema.nullable().optional(),
        en: translationPatchSchema.nullable().optional(),
      }).optional(),
    },
  }, (args) => run(async () => {
    const current = await getPostById(db, args.id);
    const base = currentAsInput(current);
    const { idBySlug } = await categoryMaps(db);

    const translations: PostUpsertInput['translations'] = {};
    for (const lang of LANGUAGES as Language[]) {
      const patch = args.translations?.[lang];
      const existing = base.translations[lang];
      if (patch === null) continue; // remove this language version
      if (patch === undefined) {
        if (existing) translations[lang] = existing;
        continue;
      }
      const title = patch.title ?? existing?.title;
      const content = patch.content ?? existing?.content;
      if (!title || !content) {
        throw new ToolError(`The ${lang} translation does not exist yet -- pass both title and content to add it.`);
      }
      translations[lang] = cleanTranslation({
        title,
        content,
        excerpt: patchField(patch.excerpt, existing?.excerpt),
        metaDescription: patchField(patch.metaDescription, existing?.metaDescription),
      });
    }

    const input = validateUpsert({
      ...base,
      slug: args.slug?.trim() || base.slug,
      status: args.status ?? base.status,
      isFeatured: args.isFeatured ?? base.isFeatured,
      youtubeId: args.youtubeId === undefined ? base.youtubeId : normalizeYoutubeId(args.youtubeId),
      soundcloudUrl: patchField(args.soundcloudUrl, base.soundcloudUrl),
      thumbnailPath: patchField(args.thumbnail, base.thumbnailPath),
      categoryIds: args.categories ? resolveCategoryIds(args.categories, idBySlug) : base.categoryIds,
      publishedAt: args.publishedAt,
      translations,
    });
    await assertThumbnailExists(input.thumbnailPath, base.thumbnailPath);
    await upsertPost(db, { ...input, id: args.id }, actor.userId);
    return json({ updated: true, post: await postDetail(db, args.id) });
  }));

  server.registerTool('set_post_status', {
    title: 'Publish / unpublish / archive',
    description: 'Changes only the status of a post: published (public), draft (hidden, work in progress) or archived (hidden, kept).',
    inputSchema: { id: z.number().int(), status: z.enum(STATUSES) },
  }, (args) => run(async () => {
    await saveChanges(db, args.id, { status: args.status }, actor);
    const post = await postDetail(db, args.id);
    return json({ id: post.id, slug: post.slug, status: post.status, publishedAt: post.publishedAt, publicUrls: post.publicUrls });
  }));

  server.registerTool('delete_post', {
    title: 'Delete post',
    description: 'Permanently deletes a post with both translations and its thumbnail file. Cannot be undone -- prefer set_post_status archived. Requires the post slug as confirmation.',
    inputSchema: {
      id: z.number().int(),
      confirmSlug: z.string().describe('Must equal the slug of the post being deleted'),
    },
    annotations: { destructiveHint: true },
  }, (args) => run(async () => {
    const current = await getPostById(db, args.id);
    if (current.post.slug !== args.confirmSlug) {
      throw new ToolError(`confirmSlug does not match: post ${args.id} has slug "${current.post.slug}".`);
    }
    await removePost(db, args.id);
    return json({ deleted: true, id: args.id, slug: current.post.slug });
  }));

  server.registerTool('list_categories', {
    title: 'List categories',
    description: 'All categories with slugs, names and descriptions.',
    annotations: { readOnlyHint: true },
  }, () => run(async () => {
    const rows = await db.select({ slug: categories.slug, name: categories.name, description: categories.description })
      .from(categories).orderBy(asc(categories.sortOrder));
    return json(rows);
  }));

  server.registerTool('upload_image', {
    title: 'Upload image',
    description: 'Stores an image (jpeg, png, gif or webp, max 10 MB) from a public URL or from base64 data. Returns the filename (for a post thumbnail), resized URLs and a markdown snippet for post content. Optionally sets it straight away as the thumbnail of a post.',
    inputSchema: {
      url: z.string().optional().describe('Public http(s) URL of the image'),
      base64: z.string().optional().describe('Image bytes as base64 (a data: URL is accepted too)'),
      setAsThumbnailOfPostId: z.number().int().optional(),
    },
  }, (args) => run(async () => {
    if (!args.url === !args.base64) throw new ToolError('Pass exactly one of url or base64.');
    const prefix = args.setAsThumbnailOfPostId ? 'thumb' : 'img';
    const filename = args.url
      ? await saveImageFromUrl(args.url, prefix)
      : await saveImageBuffer(Buffer.from((args.base64 ?? '').replace(/^data:[^;,]*;base64,/, '').replace(/\s+/g, ''), 'base64'), prefix);
    if (args.setAsThumbnailOfPostId) await saveChanges(db, args.setAsThumbnailOfPostId, { thumbnailPath: filename }, actor);
    return json({ ...imageInfo(filename), thumbnailOfPostId: args.setAsThumbnailOfPostId ?? null });
  }));

  server.registerTool('set_thumbnail_from_youtube', {
    title: 'Thumbnail from YouTube',
    description: 'Downloads the YouTube still for a video and sets it as the post thumbnail. Uses the post\'s own youtubeId unless one is given.',
    inputSchema: {
      postId: z.number().int(),
      youtubeId: z.string().optional().describe('Video id or URL; defaults to the post\'s youtubeId'),
    },
  }, (args) => run(async () => {
    const current = await getPostById(db, args.postId);
    const youtubeId = normalizeYoutubeId(args.youtubeId ?? current.post.youtubeId);
    if (!youtubeId) throw new ToolError('The post has no youtubeId -- pass one.');
    const filename = await fetchYoutubeThumbnail(youtubeId);
    await saveChanges(db, args.postId, { thumbnailPath: filename }, actor);
    return json({ postId: args.postId, thumbnail: imageInfo(filename) });
  }));

  server.registerTool('youtube_overview', {
    title: 'YouTube channel vs site',
    description: 'All public videos of the configured YouTube channels, newest first, with the post that embeds each one (or null when it is missing on the site).',
    inputSchema: {
      onlyMissing: z.boolean().default(false).describe('Only videos that have no post yet'),
      refresh: z.boolean().default(false).describe('Bypass the 10-minute cache'),
    },
    annotations: { readOnlyHint: true },
  }, (args) => run(async () => {
    const overview = await youtubeOverview(db, { refresh: args.refresh });
    if (!overview.configured) throw new ToolError(`YouTube is not configured on the server: set ${overview.missing.join(' and ')}.`);
    const videos = args.onlyMissing ? overview.videos.filter((v) => !v.post) : overview.videos;
    return json({
      channels: overview.channels,
      totals: { videos: overview.videos.length, onSite: overview.videos.filter((v) => v.post).length, missing: overview.videos.filter((v) => !v.post).length },
      videos,
    });
  }));

  server.registerTool('import_youtube_video', {
    title: 'Create post from YouTube video',
    description: "Creates a post from a video: title and description in both languages (YouTube localizations when present, otherwise the video's text in both), release date as publish date, best still as thumbnail, category from the channel.",
    inputSchema: {
      videoId: z.string().describe('Video id or YouTube URL'),
      status: z.enum(STATUSES).default('draft'),
    },
  }, (args) => run(async () => {
    const videoId = normalizeYoutubeId(args.videoId);
    if (!videoId) throw new ToolError('Pass a video id.');
    const result = await importYoutubeVideo(db, videoId, args.status, actor.userId);
    return json({ created: true, thumbnailError: result.thumbnailError, post: await postDetail(db, result.id) });
  }));

  server.registerTool('sync_post_from_youtube', {
    title: 'Refresh post from YouTube',
    description: "Re-reads the post's video: replaces texts of the languages YouTube has, keeps other existing translations, updates release date and thumbnail. Slug, status and categories stay.",
    inputSchema: { postId: z.number().int() },
  }, (args) => run(async () => {
    const result = await syncPostFromYoutube(db, args.postId, actor.userId);
    return json({ updated: true, thumbnailError: result.thumbnailError, post: await postDetail(db, args.postId) });
  }));

  server.registerTool('list_users', {
    title: 'List users',
    description: 'Registered users (Google sign-in) with role and registration date.',
    annotations: { readOnlyHint: true },
  }, () => run(async () => {
    const rows = await db.select({ name: user.name, email: user.email, role: user.role, createdAt: user.createdAt })
      .from(user).orderBy(desc(user.createdAt));
    return json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
  }));

  return server;
}
