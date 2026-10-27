import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { randomBytes } from 'node:crypto';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import nodePath from 'node:path';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createDb, categories, postTranslations, user } from '@carnaby/db';
import { appRouter } from '../trpc/app-router';
import { eq } from 'drizzle-orm';

const url = process.env['TEST_DATABASE_URL'];
const d = url ? describe : describe.skip;

d('posts admin', () => {
  const { db, pool } = createDb(url!);
  // Isolation note: mirrors posts.read.integration.spec's rationale — this test DB is shared
  // (other spec files, possible concurrent `nx run-many` runs) and never cleaned between runs.
  // The brief's snippet hardcodes email 'a@a.sk' and slug 'adm-' + Date.now(); email is unique
  // on `user`, and if a previous run's row with that email still exists (different random id),
  // `onConflictDoNothing()` would silently keep the OLD id — then this run's `adminUser.id`
  // (used as `posts.authorId`, FK'd to `user.id`) would reference a row that was never inserted,
  // failing the post insert with a foreign-key violation. A run-unique email closes that gap.
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const adminUser = { id: randomBytes(16).toString('hex'), email: `admin-${runId}@a.sk`, name: 'A', image: null, role: 'admin' };
  const nonAdminUser = { id: randomBytes(16).toString('hex'), email: `user-${runId}@a.sk`, name: 'U', image: null, role: 'user' };
  const admin = appRouter.createCaller({ db, user: adminUser });
  const anon = appRouter.createCaller({ db, user: null });
  const nonAdmin = appRouter.createCaller({ db, user: nonAdminUser });
  const categorySlug = `adm-${runId}`;
  let catId = 0;

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: __dirname + '/../../../../packages/db/migrations' });
    await db.insert(user).values({ id: adminUser.id, email: adminUser.email, name: 'A' }).onConflictDoNothing();
    await db.insert(user).values({ id: nonAdminUser.id, email: nonAdminUser.email, name: 'U' }).onConflictDoNothing();
    const [c] = await db.insert(categories).values({ slug: categorySlug, name: 'Adm' }).returning();
    catId = c!.id;
  });
  afterAll(async () => { await pool.end(); });

  it('rejects non-admin', async () => {
    await expect(anon.posts.adminList({})).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects user role with FORBIDDEN', async () => {
    await expect(nonAdmin.posts.adminList({})).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('create → byId → update (drops EN) → adminList → remove', async () => {
    const { id } = await admin.posts.create({
      slug: `adm-post-${runId}`, status: 'draft', isFeatured: false, categoryIds: [catId],
      translations: { sk: { title: 'SK', content: 'sk body' }, en: { title: 'EN', content: 'en body' } },
    });
    const loaded = await admin.posts.byId({ id });
    expect(loaded.translations.en?.title).toBe('EN');
    expect(loaded.categoryIds).toEqual([catId]);

    await admin.posts.update({ id, slug: loaded.post.slug, status: 'published', isFeatured: true,
      categoryIds: [catId], translations: { sk: { title: 'SK2', content: 'sk body' } } });
    const after = await db.select().from(postTranslations).where(eq(postTranslations.postId, id));
    expect(after.map((t) => t.language)).toEqual(['sk']);

    // Scoped to this run's unique category (rather than the brief's unfiltered `adminList({})`)
    // so the assertion is robust against the shared, never-cleaned test DB accumulating more
    // than a page's worth of posts over time — see posts.read.integration.spec's isolation note.
    const list = await admin.posts.adminList({ category: categorySlug });
    const row = list.items.find((i) => i.id === id)!;
    expect(row.status).toBe('published');
    expect(row.hasSk).toBe(true);
    expect(row.hasEn).toBe(false);

    await admin.posts.remove({ id });
    await expect(admin.posts.byId({ id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

d('posts admin -- regressions', () => {
  const { db, pool } = createDb(url!);
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const adminUser = { id: randomBytes(16).toString('hex'), email: `admin2-${runId}@a.sk`, name: 'A', image: null, role: 'admin' };
  const admin = appRouter.createCaller({ db, user: adminUser });
  const post = (slug: string, extra: Record<string, unknown> = {}) => ({
    slug, status: 'draft' as const, isFeatured: false, categoryIds: [],
    translations: { sk: { title: 'T', content: 'C' } }, ...extra,
  });

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: __dirname + '/../../../../packages/db/migrations' });
    await db.insert(user).values({ id: adminUser.id, email: adminUser.email, name: 'A' });
  });
  afterAll(async () => { await pool.end(); });

  // drizzle >= 0.44 wraps the pg error in DrizzleQueryError (`.cause`); this used to surface as
  // a 500 carrying the full SQL text instead of a CONFLICT.
  it('maps a duplicate slug to CONFLICT', async () => {
    await admin.posts.create(post(`dup-${runId}`));
    await expect(admin.posts.create(post(`dup-${runId}`))).rejects.toMatchObject({ code: 'CONFLICT', message: 'slug already in use' });
  });

  it('keeps a thumbnail file that another post still uses', async () => {
    const dir = await fsp.mkdtemp(nodePath.join(os.tmpdir(), 'carnaby-thumb-'));
    process.env['UPLOADS_DIR'] = dir;
    await fsp.mkdir(nodePath.join(dir, 'originals'), { recursive: true });
    const shared = `yt-shared${runId.replace(/[^a-z0-9]/g, '')}.jpg`;
    await fsp.writeFile(nodePath.join(dir, 'originals', shared), 'x');

    const a = await admin.posts.create(post(`thumb-a-${runId}`, { thumbnailPath: shared }));
    const b = await admin.posts.create(post(`thumb-b-${runId}`, { thumbnailPath: shared }));

    await admin.posts.remove({ id: a.id });
    await expect(fsp.access(nodePath.join(dir, 'originals', shared))).resolves.toBeUndefined();

    await admin.posts.update({ id: b.id, ...post(`thumb-b-${runId}`) }); // thumbnail cleared
    await expect(fsp.access(nodePath.join(dir, 'originals', shared))).rejects.toThrow();
  });

  it('filters the admin list by search text', async () => {
    const { id } = await admin.posts.create(post(`hladany-${runId}`, { translations: { sk: { title: `Ihla v kope sena ${runId}`, content: 'x' } } }));
    const result = await admin.posts.adminList({ search: `IHLA V KOPE SENA ${runId}` });
    expect(result.items.map((i) => i.id)).toEqual([id]);
    expect(result.total).toBe(1);
  });

  it('setFeatured toggles only the featured flag', async () => {
    const { id } = await admin.posts.create(post(`hviezda-${runId}`));
    await admin.posts.setFeatured({ id, isFeatured: true });
    const on = await admin.posts.byId({ id });
    expect(on.post.isFeatured).toBe(true);
    expect(on.post.status).toBe('draft');
    expect(on.translations.sk?.title).toBeTruthy();

    await admin.posts.setFeatured({ id, isFeatured: false });
    expect((await admin.posts.byId({ id })).post.isFeatured).toBe(false);
  });

  it('setFeatured is admin-only and 404s an unknown id', async () => {
    const nonAdmin = appRouter.createCaller({ db, user: { ...adminUser, id: 'not-admin', role: 'user' } });
    await expect(nonAdmin.posts.setFeatured({ id: 1, isFeatured: true })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(admin.posts.setFeatured({ id: 2_000_000_000, isFeatured: true })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
