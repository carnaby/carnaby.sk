import { promises as fs } from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BlockedUrlError, InvalidImageError, NoShareImageError } from './errors';
import type { UrlPolicy } from './safe-fetch';
import { saveImageFromLink } from './uploads.service';

const LOCAL: UrlPolicy = { isAllowedAddress: (ip) => ip === '127.0.0.1', allowAnyPort: true };
let base = '';
let server: http.Server;
let uploadsDir: string;

beforeAll(async () => {
  uploadsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'carnaby-link-'));
  process.env['UPLOADS_DIR'] = uploadsDir;
  const png = await sharp({ create: { width: 40, height: 21, channels: 3, background: '#10b981' } }).png().toBuffer();
  const page = (head: string) => `<!doctype html><html><head>${head}</head><body>${'x'.repeat(10)}</body></html>`;
  server = http.createServer((req, res) => {
    const html = (body: string) => res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(body);
    switch (req.url) {
      case '/project/': return html(page('<meta property="og:image" content="/og.png">'));
      case '/og.png': return res.writeHead(200, { 'content-type': 'image/png' }).end(png);
      case '/no-image': return html(page('<title>none</title>'));
      case '/json': return res.writeHead(200, { 'content-type': 'application/json' }).end('{"og:image":"/og.png"}');
      case '/internal-image': return html(page('<meta property="og:image" content="http://10.0.0.1/og.png">'));
      case '/fake-image': return html(page('<meta property="og:image" content="/project/">'));
      case '/huge': return html(page(`<meta property="og:image" content="/og.png">`) + ' '.repeat(2 * 1024 * 1024));
      default: return res.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(uploadsDir, { recursive: true, force: true });
});

describe('saveImageFromLink', () => {
  it('saves the page og:image as a link- original', async () => {
    const filename = await saveImageFromLink(`${base}/project/`, LOCAL);
    expect(filename).toMatch(/^link-\d+-[0-9a-f]{6}\.png$/);
    await expect(fs.access(path.join(uploadsDir, 'originals', filename))).resolves.toBeUndefined();
  });

  it('still finds the image in a page larger than 1 MB', async () => {
    await expect(saveImageFromLink(`${base}/huge`, LOCAL)).resolves.toMatch(/^link-/);
  });

  it('reports a page without a share image', async () => {
    await expect(saveImageFromLink(`${base}/no-image`, LOCAL)).rejects.toBeInstanceOf(NoShareImageError);
  });

  it('reports a link that is not an HTML page', async () => {
    await expect(saveImageFromLink(`${base}/json`, LOCAL)).rejects.toBeInstanceOf(NoShareImageError);
  });

  it('blocks an og:image on an internal address', async () => {
    await expect(saveImageFromLink(`${base}/internal-image`, LOCAL)).rejects.toBeInstanceOf(BlockedUrlError);
  });

  it('rejects an og:image that is not an image', async () => {
    await expect(saveImageFromLink(`${base}/fake-image`, LOCAL)).rejects.toBeInstanceOf(InvalidImageError);
  });
});
