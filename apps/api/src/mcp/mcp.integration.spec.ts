import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { eq } from 'drizzle-orm';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { categories, createDb, oauthAccessToken, oauthApplication, posts, user } from '@carnaby/db';
import { createAuth } from '../auth/auth';
import { authenticateMcpRequest } from './mcp-auth';
import { createCarnabyMcpServer } from './server';

const url = process.env['TEST_DATABASE_URL'];
const d = url ? describe : describe.skip;

type ToolResult = { isError?: boolean; content: { type: string; text: string }[] };

d('carnaby MCP server', () => {
  const { db, pool } = createDb(url!);
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const adminId = randomBytes(16).toString('hex');
  const categorySlug = `mcp-${runId}`;
  let client: Client;
  let uploadsDir: string;

  async function call(name: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
    return (await client.callTool({ name, arguments: args })) as ToolResult;
  }
  async function ok<T = Record<string, unknown>>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    const result = await call(name, args);
    if (result.isError) throw new Error(`${name} failed: ${result.content[0]?.text}`);
    return JSON.parse(result.content[0]!.text) as T;
  }

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: __dirname + '/../../../../packages/db/migrations' });
    uploadsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'carnaby-mcp-'));
    process.env['UPLOADS_DIR'] = uploadsDir;
    process.env['CACHE_DIR'] = path.join(uploadsDir, 'cache');
    await db.insert(user).values({ id: adminId, email: `mcp-admin-${runId}@a.sk`, name: 'MCP Admin', role: 'admin' });
    await db.insert(categories).values({ slug: categorySlug, name: 'MCP test' });

    const server = createCarnabyMcpServer(db, { userId: adminId, email: null, via: 'static-token' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'test', version: '1.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  afterAll(async () => {
    await client?.close();
    await pool.end();
    await fs.rm(uploadsDir, { recursive: true, force: true });
  });

  it('advertises every admin capability as a tool, with instructions', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'create_post', 'delete_post', 'get_post', 'list_categories', 'list_posts', 'list_users',
      'set_post_status', 'set_thumbnail_from_youtube', 'site_overview', 'update_post', 'upload_image',
    ]);
    expect(client.getInstructions()).toContain('carnaby.sk');
  });

  it('runs a full post lifecycle: create → partial update → publish → archive → delete', async () => {
    const created = await ok<{ post: { id: number; slug: string; status: string; categories: string[] } }>('create_post', {
      translations: { sk: { title: `Nový song ${runId}`, content: '## Sloha\n\ntext', excerpt: 'Teaser' } },
      categories: [categorySlug],
      youtubeId: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    });
    const { id, slug } = created.post;
    expect(created.post.status).toBe('draft');
    expect(slug).toBe(`novy-song-${runId}`);
    expect(created.post.categories).toEqual([categorySlug]);

    // Partial update: add EN, change only the SK excerpt, keep everything else.
    const updated = await ok<{ post: Record<string, any> }>('update_post', {
      id,
      translations: { sk: { excerpt: 'Nový teaser' }, en: { title: 'New song', content: 'lyrics' } },
    });
    expect(updated.post.translations.sk).toMatchObject({ title: `Nový song ${runId}`, content: '## Sloha\n\ntext', excerpt: 'Nový teaser' });
    expect(updated.post.translations.en).toMatchObject({ title: 'New song', content: 'lyrics' });
    expect(updated.post.youtubeId).toBe('dQw4w9WgXcQ');
    expect(updated.post.categories).toEqual([categorySlug]);

    const published = await ok<{ status: string; publishedAt: string; publicUrls: { sk: string } }>('set_post_status', { id, status: 'published' });
    expect(published.status).toBe('published');
    expect(published.publishedAt).toBeTruthy();
    expect(published.publicUrls.sk).toMatch(new RegExp(`/posts/${slug}$`));

    const bySlug = await ok<{ id: number }>('get_post', { slug });
    expect(bySlug.id).toBe(id);

    const listed = await ok<{ items: { id: number; languages: string[] }[] }>('list_posts', { category: categorySlug, search: 'nový song' });
    expect(listed.items.map((p) => p.id)).toEqual([id]);
    expect(listed.items[0]!.languages).toEqual(['sk', 'en']);

    // Removing a language version.
    const noEn = await ok<{ post: { translations: { en: unknown } } }>('update_post', { id, translations: { en: null } });
    expect(noEn.post.translations.en).toBeNull();

    await ok('set_post_status', { id, status: 'archived' });

    const wrongConfirm = await call('delete_post', { id, confirmSlug: 'nope' });
    expect(wrongConfirm.isError).toBe(true);
    await ok('delete_post', { id, confirmSlug: slug });
    expect(await db.select().from(posts).where(eq(posts.id, id))).toHaveLength(0);
  });

  it('reports validation problems as readable tool errors instead of throwing', async () => {
    const noTranslation = await call('create_post', { translations: {} });
    expect(noTranslation.isError).toBe(true);
    expect(noTranslation.content[0]!.text).toMatch(/translation/i);

    const badCategory = await call('create_post', { translations: { sk: { title: 'x', content: 'y' } }, categories: ['nope'] });
    expect(badCategory.content[0]!.text).toMatch(/Unknown category: nope/);

    const slug = `dup-${runId}`;
    await ok('create_post', { slug, translations: { sk: { title: 'a', content: 'b' } } });
    const duplicate = await call('create_post', { slug, translations: { sk: { title: 'a', content: 'b' } } });
    expect(duplicate.isError).toBe(true);
    expect(duplicate.content[0]!.text).toMatch(/slug already in use/);

    const badThumb = await call('create_post', { translations: { sk: { title: 'x', content: 'y' } }, thumbnail: 'typo.png' });
    expect(badThumb.content[0]!.text).toMatch(/does not exist/);

    const missing = await call('get_post', { id: 999_999_999 });
    expect(missing.content[0]!.text).toBe('Post not found.');
  });

  it('uploads a base64 image, sets it as thumbnail and cleans the old file up on replace', async () => {
    const png = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#a855f7' } }).png().toBuffer();
    const { post } = await ok<{ post: { id: number } }>('create_post', { translations: { sk: { title: `Obrázok ${runId}`, content: 'x' } } });

    const first = await ok<{ filename: string; markdown: string }>('upload_image', {
      base64: `data:image/png;base64,${png.toString('base64')}`,
      setAsThumbnailOfPostId: post.id,
    });
    expect(first.filename).toMatch(/^thumb-\d+-[0-9a-f]{6}\.png$/);
    expect(first.markdown).toBe(`![](/images/1200/${first.filename})`);
    await expect(fs.access(path.join(uploadsDir, 'originals', first.filename))).resolves.toBeUndefined();

    const second = await ok<{ filename: string }>('upload_image', { base64: png.toString('base64'), setAsThumbnailOfPostId: post.id });
    const detail = await ok<{ thumbnail: { filename: string } }>('get_post', { id: post.id });
    expect(detail.thumbnail.filename).toBe(second.filename);
    await expect(fs.access(path.join(uploadsDir, 'originals', first.filename))).rejects.toThrow();

    const notAnImage = await call('upload_image', { base64: Buffer.from('<html>nope</html>').toString('base64') });
    expect(notAnImage.isError).toBe(true);
    expect(notAnImage.content[0]!.text).toMatch(/not a valid image/);
  });

  it('summarises the site', async () => {
    const overview = await ok<{ totalPosts: number; byStatus: Record<string, number> }>('site_overview');
    expect(overview.totalPosts).toBeGreaterThan(0);
    expect(Object.keys(overview.byStatus)).toEqual(['draft', 'published', 'archived']);
  });

  describe('authentication', () => {
    const auth = createAuth(db);
    const staticToken = 'x'.repeat(40);
    const env = { MCP_API_TOKEN: staticToken, ADMIN_EMAILS: `mcp-admin-${runId}@a.sk` };

    async function issueOAuthToken(userId: string, expiresInMs = 60_000): Promise<string> {
      const clientId = `client-${randomBytes(6).toString('hex')}`;
      await db.insert(oauthApplication).values({ id: clientId, name: 'Claude', clientId, redirectUrls: 'https://claude.ai/cb', type: 'public' });
      const accessToken = randomBytes(24).toString('hex');
      await db.insert(oauthAccessToken).values({
        id: randomBytes(8).toString('hex'), accessToken, refreshToken: randomBytes(24).toString('hex'),
        accessTokenExpiresAt: new Date(Date.now() + expiresInMs), refreshTokenExpiresAt: new Date(Date.now() + 86_400_000),
        clientId, userId, scopes: 'openid',
      });
      return accessToken;
    }

    it('requires a bearer token', async () => {
      expect(await authenticateMcpRequest(auth, db, {}, env)).toMatchObject({ ok: false, status: 401 });
    });

    it('accepts the static token and acts as the ADMIN_EMAILS user', async () => {
      const result = await authenticateMcpRequest(auth, db, { authorization: `Bearer ${staticToken}` }, env);
      expect(result).toEqual({ ok: true, actor: { userId: adminId, email: `mcp-admin-${runId}@a.sk`, via: 'static-token' } });
    });

    it('ignores a static token that is too short to be safe', async () => {
      const result = await authenticateMcpRequest(auth, db, { authorization: 'Bearer short' }, { MCP_API_TOKEN: 'short' });
      expect(result).toMatchObject({ ok: false, status: 401 });
    });

    it('accepts an OAuth token owned by an admin', async () => {
      const token = await issueOAuthToken(adminId);
      const result = await authenticateMcpRequest(auth, db, { authorization: `Bearer ${token}` }, {});
      expect(result).toMatchObject({ ok: true, actor: { userId: adminId, via: 'oauth' } });
    });

    it('rejects an OAuth token owned by a regular user with 403', async () => {
      const regularId = randomBytes(16).toString('hex');
      await db.insert(user).values({ id: regularId, email: `mcp-user-${runId}@a.sk`, name: 'U', role: 'user' });
      const token = await issueOAuthToken(regularId);
      expect(await authenticateMcpRequest(auth, db, { authorization: `Bearer ${token}` }, {})).toMatchObject({ ok: false, status: 403 });
    });

    it('rejects expired and unknown OAuth tokens with 401', async () => {
      const expired = await issueOAuthToken(adminId, -1000);
      expect(await authenticateMcpRequest(auth, db, { authorization: `Bearer ${expired}` }, {})).toMatchObject({ ok: false, status: 401 });
      expect(await authenticateMcpRequest(auth, db, { authorization: 'Bearer unknown' }, {})).toMatchObject({ ok: false, status: 401 });
    });
  });
});
