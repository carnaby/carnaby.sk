import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { eq } from 'drizzle-orm';
import * as express from 'express';
import { promises as fs } from 'node:fs';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, imageUploadLinks, posts } from '@carnaby/db';
import { DB } from '../db/db.module';
import { getPostById, upsertPost } from '../posts/posts.admin';
import { UploadLinkController } from './upload-link.controller';
import { UPLOAD_LINK_TTL_MS, createUploadLink, hashUploadToken } from './upload-links';
import { MAX_IMAGE_BYTES } from './uploads.service';

const url = process.env['TEST_DATABASE_URL'];
const d = url ? describe : describe.skip;

const INVALID = 'Upload link is invalid, expired or already used -- call create_image_upload again.';
const TOO_LARGE = 'Image too large (max 10 MB).';

d('PUT /api/uploads/link/:token', () => {
  const { db, pool } = createDb(url!);
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let n = 0;
  let app: INestApplication;
  let base = '';
  let uploadsDir: string;
  let png: Buffer;

  const newLink = (thumbnailPostId: number | null = null, now?: Date) =>
    createUploadLink(db, { createdBy: null, thumbnailPostId }, now).then((l) => l.token);
  const put = (token: string, body: RequestInit['body'], headers?: Record<string, string>) =>
    fetch(`${base}/api/uploads/link/${token}`, { method: 'PUT', body, headers });
  const originals = () => fs.readdir(path.join(uploadsDir, 'originals')).catch(() => [] as string[]);
  const newPost = async () => {
    const { id } = await upsertPost(db, {
      slug: `ulc-${runId}-${n++}`, status: 'draft', isFeatured: false, categoryIds: [],
      translations: { sk: { title: 'Upload link', content: 'text' } },
    }, null);
    return id;
  };

  beforeAll(async () => {
    png = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#f00' } }).png().toBuffer();
    await migrate(db, { migrationsFolder: __dirname + '/../../../../packages/db/migrations' });
    uploadsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'carnaby-upload-link-'));
    process.env['UPLOADS_DIR'] = uploadsDir;
    process.env['CACHE_DIR'] = path.join(uploadsDir, 'cache');

    const moduleRef = await Test.createTestingModule({
      controllers: [UploadLinkController],
      providers: [{ provide: DB, useValue: db }],
    }).compile();
    // Same body handling as main.ts: no default parsers, only the global JSON one.
    app = moduleRef.createNestApplication({ bodyParser: false });
    app.use(express.json({ limit: '1mb' }));
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await app?.close();
    await pool.end();
    await fs.rm(uploadsDir, { recursive: true, force: true });
  });

  it('stores the image and returns filename, urls and markdown', async () => {
    const res = await put(await newLink(), png);
    expect(res.status).toBe(200);
    const body = await res.json() as { filename: string; urls: Record<string, string>; markdown: string; thumbnailOfPostId: number | null };
    expect(body.filename).toMatch(/^img-/);
    expect(body.urls['1200']).toMatch(new RegExp(`/images/1200/${body.filename}$`));
    expect(body.markdown).toBe(`![](/images/1200/${body.filename})`);
    expect(body.thumbnailOfPostId).toBeNull();
    expect(await originals()).toContain(body.filename);
  });

  it('sets the thumbnail of the linked post', async () => {
    const postId = await newPost();
    const res = await put(await newLink(postId), png);
    expect(res.status).toBe(200);
    const body = await res.json() as { filename: string; thumbnailOfPostId: number | null };
    expect(body.filename).toMatch(/^thumb-/);
    expect(body.thumbnailOfPostId).toBe(postId);
    expect((await getPostById(db, postId)).post.thumbnailPath).toBe(body.filename);
  });

  it('second PUT on the same link → 404', async () => {
    const token = await newLink();
    expect((await put(token, png)).status).toBe(200);
    const res = await put(token, png);
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ statusCode: 404, message: INVALID });
    const [row] = await db.select().from(imageUploadLinks).where(eq(imageUploadLinks.tokenHash, hashUploadToken(token)));
    expect(row!.filename).toMatch(/^img-/);
  });

  it('unknown token → 404', async () => {
    const res = await put('no-such-token', png);
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ statusCode: 404, message: INVALID });
  });

  it('expired link → 404', async () => {
    const token = await newLink(null, new Date(Date.now() - UPLOAD_LINK_TTL_MS - 1000));
    const res = await put(token, png);
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ statusCode: 404, message: INVALID });
  });

  it('empty body → 400 "image is empty", then a valid PNG on the same link → 200', async () => {
    const token = await newLink();
    const res = await put(token, new Uint8Array(0));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ statusCode: 400, message: 'image is empty' });
    expect((await put(token, png)).status).toBe(200);
  });

  it('text body → 400, then a valid PNG on the same link → 200', async () => {
    const token = await newLink();
    const res = await put(token, 'hello');
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ statusCode: 400, message: 'file is not a valid image' });
    expect((await put(token, png)).status).toBe(200);
  });

  it('explicit Content-Type image/png and application/octet-stream work', async () => {
    for (const type of ['image/png', 'application/octet-stream', 'application/x-www-form-urlencoded']) {
      const res = await put(await newLink(), png, { 'content-type': type });
      expect(res.status, type).toBe(200);
    }
  });

  it('body over 10 MB → 413, and the link stays usable', async () => {
    const token = await newLink();
    const before = await originals();
    const res = await put(token, Buffer.alloc(MAX_IMAGE_BYTES + 1));
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ statusCode: 413, message: TOO_LARGE });
    expect(await originals()).toEqual(before);
    expect((await put(token, png)).status).toBe(200);
  });

  it('streamed (chunked) body over 10 MB → 413, and the link stays usable', async () => {
    const token = await newLink();
    const chunk = Buffer.alloc(1024 * 1024);
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent > MAX_IMAGE_BYTES) return controller.close();
        controller.enqueue(chunk);
        sent += chunk.length;
      },
    });
    const res = await fetch(`${base}/api/uploads/link/${token}`, { method: 'PUT', body: stream, duplex: 'half' } as RequestInit);
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ statusCode: 413, message: TOO_LARGE });
    expect((await put(token, png)).status).toBe(200);
  });

  it('post deleted after link creation → 404, nothing written to originals/', async () => {
    const postId = await newPost();
    const token = await newLink(postId);
    await db.delete(posts).where(eq(posts.id, postId));
    const before = await originals();
    const res = await put(token, png);
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ statusCode: 404, message: INVALID });
    expect(await originals()).toEqual(before);
  });

  it('two concurrent PUTs on one link → one 200, one 404', async () => {
    const token = await newLink();
    const statuses = (await Promise.all([put(token, png), put(token, png)])).map((r) => r.status).sort();
    expect(statuses).toEqual([200, 404]);
  });
});
