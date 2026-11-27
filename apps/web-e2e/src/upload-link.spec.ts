import { randomBytes } from 'node:crypto';

import { expect, test } from '@playwright/test';
import sharp from 'sharp';

import { deleteUploadLink, seedUploadLink } from './support/db';

/**
 * The one-time upload link goes through the web's rewrite (`E2E_BASE_URL`), not straight to the
 * API: the proxy's body-size limit (`proxyClientMaxBodySize`) is exactly what these tests guard.
 */
test.describe('image upload link through the web proxy', () => {
  let token: string;

  test.beforeEach(async () => {
    token = await seedUploadLink();
  });

  test.afterEach(async () => {
    await deleteUploadLink(token);
  });

  test('uploads a ~9 MB image through the web proxy', async ({ request }) => {
    const width = 1800;
    const height = 1800;
    // Random noise does not compress, so the PNG stays above 8 MB.
    const png = await sharp(randomBytes(width * height * 3), { raw: { width, height, channels: 3 } })
      .png({ compressionLevel: 0 })
      .toBuffer();
    expect(png.length).toBeGreaterThan(8 * 1024 * 1024);
    expect(png.length).toBeLessThan(10 * 1024 * 1024);

    const res = await request.put(`/api/uploads/link/${token}`, {
      data: png,
      headers: { 'content-type': 'image/png' },
      timeout: 55_000,
    });
    expect(res.status(), await res.text()).toBe(200);
    const body = (await res.json()) as { filename?: string };
    expect(body.filename).toBeTruthy();
  });

  test('answers 413 for a body over 10 MB through the web proxy', async ({ request }) => {
    const res = await request.put(`/api/uploads/link/${token}`, {
      data: Buffer.alloc(10.5 * 1024 * 1024, 1),
      headers: { 'content-type': 'application/octet-stream' },
      timeout: 55_000,
    });
    // Not 400 "not a valid image": that would mean the proxy truncated the body.
    expect(res.status()).toBe(413);
    const body = (await res.json()) as { message?: string };
    expect(body.message).toBe('Image too large (max 10 MB).');
  });

  test('answers 413 quickly for a body over the proxy limit (16 MB)', async ({ request }) => {
    // Next cuts this body short at 16 MB but forwards the full Content-Length: the API must not
    // wait for bytes that never come (it used to hang until the proxy gave up with a 500).
    const started = Date.now();
    const res = await request.put(`/api/uploads/link/${token}`, {
      data: Buffer.alloc(17.5 * 1024 * 1024, 1),
      headers: { 'content-type': 'application/octet-stream' },
      timeout: 55_000,
    });
    const elapsed = Date.now() - started;
    expect(res.status()).toBe(413);
    const body = (await res.json()) as { message?: string };
    expect(body.message).toBe('Image too large (max 10 MB).');
    expect(elapsed).toBeLessThan(10_000);
  });
});
