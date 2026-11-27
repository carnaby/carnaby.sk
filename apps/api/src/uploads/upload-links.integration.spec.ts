import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, imageUploadLinks, posts } from '@carnaby/db';
import {
  UPLOAD_LINK_TTL_MS,
  claimUploadLink,
  completeUploadLink,
  createUploadLink,
  findUsableUploadLink,
  hashUploadToken,
  releaseUploadLink,
} from './upload-links';

const url = process.env['TEST_DATABASE_URL'];
const d = url ? describe : describe.skip;

d('upload links', () => {
  const { db, pool } = createDb(url!);
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let n = 0;
  const newPost = async () => {
    const [p] = await db.insert(posts).values({ slug: `ul-${runId}-${n++}` }).returning();
    return p!.id;
  };
  const rowFor = async (token: string) => {
    const [r] = await db.select().from(imageUploadLinks).where(eq(imageUploadLinks.tokenHash, hashUploadToken(token)));
    return r;
  };

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: __dirname + '/../../../../packages/db/migrations' });
  });
  afterAll(async () => { await pool.end(); });

  it('stores only the hash', async () => {
    const now = new Date();
    const { token, expiresAt } = await createUploadLink(db, { createdBy: null, thumbnailPostId: null }, now);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(expiresAt.getTime() - now.getTime()).toBe(UPLOAD_LINK_TTL_MS);
    const row = await rowFor(token);
    expect(row!.tokenHash).toBe(hashUploadToken(token));
    expect(Object.values(row!).some((v) => v === token)).toBe(false);
  });

  it('claims once', async () => {
    const { token } = await createUploadLink(db, { createdBy: null, thumbnailPostId: null });
    expect(await claimUploadLink(db, token)).toMatchObject({ createdBy: null, thumbnailPostId: null });
    expect(await claimUploadLink(db, token)).toBeNull();
  });

  it('two concurrent claims: exactly one wins', async () => {
    const { token } = await createUploadLink(db, { createdBy: null, thumbnailPostId: null });
    const res = await Promise.all([claimUploadLink(db, token), claimUploadLink(db, token)]);
    expect(res.filter((r) => r !== null)).toHaveLength(1);
  });

  it('release makes it claimable again; complete keeps it used and stores filename', async () => {
    const { token } = await createUploadLink(db, { createdBy: null, thumbnailPostId: null });
    const link = (await claimUploadLink(db, token))!;
    await releaseUploadLink(db, link.id);
    expect(await findUsableUploadLink(db, token)).not.toBeNull();
    const again = (await claimUploadLink(db, token))!;
    expect(again.id).toBe(link.id);
    await completeUploadLink(db, again.id, 'img-1.webp');
    expect(await claimUploadLink(db, token)).toBeNull();
    expect(await findUsableUploadLink(db, token)).toBeNull();
    const row = await rowFor(token);
    expect(row!.filename).toBe('img-1.webp');
    expect(row!.usedAt).not.toBeNull();
  });

  it('expired link is neither usable nor claimable', async () => {
    const { token } = await createUploadLink(db, { createdBy: null, thumbnailPostId: null }, new Date(Date.now() - 2 * 3_600_000));
    expect(await findUsableUploadLink(db, token)).toBeNull();
    expect(await claimUploadLink(db, token)).toBeNull();
  });

  it('unknown token → null', async () => {
    const token = randomBytes(32).toString('base64url');
    expect(await findUsableUploadLink(db, token)).toBeNull();
    expect(await claimUploadLink(db, token)).toBeNull();
  });

  it('deleting the thumbnail post deletes the link', async () => {
    const postId = await newPost();
    const { token } = await createUploadLink(db, { createdBy: null, thumbnailPostId: postId });
    expect((await findUsableUploadLink(db, token))!.thumbnailPostId).toBe(postId);
    await db.delete(posts).where(eq(posts.id, postId));
    expect(await rowFor(token)).toBeUndefined();
  });

  it('creating a link removes links expired over 24 h ago', async () => {
    const old = await createUploadLink(db, { createdBy: null, thumbnailPostId: null }, new Date(Date.now() - 26 * 3_600_000));
    expect(await rowFor(old.token)).toBeDefined();
    await createUploadLink(db, { createdBy: null, thumbnailPostId: null });
    expect(await rowFor(old.token)).toBeUndefined();
  });
});
