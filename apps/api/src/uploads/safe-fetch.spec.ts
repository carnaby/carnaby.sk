import http from 'node:http';
import type { AddressInfo } from 'node:net';
import zlib from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { BlockedUrlError, ResponseTooLargeError, UpstreamNotFoundError, UpstreamUnavailableError } from './errors';
import { safeFetch, type UrlPolicy } from './safe-fetch';

/** Local server on 127.0.0.1: allow exactly that address and its random port, nothing else. */
const LOCAL: UrlPolicy = { isAllowedAddress: (ip) => ip === '127.0.0.1', allowAnyPort: true };

let base = '';
let server: http.Server;
let loopHits = 0;
let slowSocketClosed: Promise<void> = Promise.resolve();
const timers: NodeJS.Timeout[] = [];
const zeros = Buffer.alloc(32 * 1024 * 1024);
const brBomb = zlib.brotliCompressSync(zeros);
const gzipBomb = zlib.gzipSync(zeros);

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const path = req.url ?? '/';
    if (path === '/ok') return res.writeHead(200, { 'content-type': 'text/plain' }).end('hello');
    if (path === '/redirect') return res.writeHead(302, { location: '/ok' }).end();
    if (path === '/loop') {
      loopHits++;
      return res.writeHead(302, { location: '/loop' }).end();
    }
    if (path === '/bomb-br') return res.writeHead(200, { 'content-encoding': 'br' }).end(brBomb);
    if (path === '/bomb-gzip') return res.writeHead(200, { 'content-encoding': 'gzip' }).end(gzipBomb);
    if (path === '/slow500') {
      res.writeHead(500);
      slowSocketClosed = new Promise<void>((resolve) => req.socket.on('close', () => resolve()));
      timers.push(setInterval(() => res.write('z'), 50));
      return;
    }
    if (path === '/to-private') return res.writeHead(301, { location: 'http://10.0.0.1/secret' }).end();
    if (path === '/missing') return res.writeHead(404).end();
    if (path === '/boom') return res.writeHead(500).end();
    if (path === '/big-declared') return res.writeHead(200, { 'content-length': '5000' }).end('x'.repeat(5000));
    if (path === '/big-chunked') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      for (let i = 0; i < 10; i++) res.write('y'.repeat(500));
      return res.end();
    }
    if (path === '/gzip') {
      return res.writeHead(200, { 'content-type': 'text/html', 'content-encoding': 'gzip' }).end(zlib.gzipSync('<p>zipped</p>'));
    }
    if (path === '/hang') return; // never answers
    res.writeHead(400).end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  timers.forEach(clearInterval);
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

describe('safeFetch with a local test policy', () => {
  it('returns body, content type and final url', async () => {
    const res = await safeFetch(`${base}/ok`, { maxBytes: 1000, policy: LOCAL });
    expect(res.body.toString()).toBe('hello');
    expect(res.contentType).toBe('text/plain');
    expect(res.url.pathname).toBe('/ok');
  });

  it('follows a relative redirect and reports the final url', async () => {
    const res = await safeFetch(`${base}/redirect`, { maxBytes: 1000, policy: LOCAL });
    expect(res.body.toString()).toBe('hello');
    expect(res.url.pathname).toBe('/ok');
  });

  it('stops after 3 redirects', async () => {
    loopHits = 0;
    await expect(safeFetch(`${base}/loop`, { maxBytes: 1000, policy: LOCAL })).rejects.toThrow(/redirects/);
    expect(loopHits).toBe(4); // the first request plus 3 redirects
  });

  it('re-checks every redirect target', async () => {
    await expect(safeFetch(`${base}/to-private`, { maxBytes: 1000, policy: LOCAL })).rejects.toBeInstanceOf(BlockedUrlError);
  });

  it('maps 404 to UpstreamNotFoundError and 500 to UpstreamUnavailableError', async () => {
    await expect(safeFetch(`${base}/missing`, { maxBytes: 1000, policy: LOCAL })).rejects.toBeInstanceOf(UpstreamNotFoundError);
    await expect(safeFetch(`${base}/boom`, { maxBytes: 1000, policy: LOCAL })).rejects.toBeInstanceOf(UpstreamUnavailableError);
  });

  it('refuses bodies over the cap, declared or streamed', async () => {
    await expect(safeFetch(`${base}/big-declared`, { maxBytes: 1000, policy: LOCAL })).rejects.toBeInstanceOf(ResponseTooLargeError);
    await expect(safeFetch(`${base}/big-chunked`, { maxBytes: 1000, policy: LOCAL })).rejects.toBeInstanceOf(ResponseTooLargeError);
  });

  it('truncates instead when asked to', async () => {
    const res = await safeFetch(`${base}/big-chunked`, { maxBytes: 1000, truncate: true, policy: LOCAL });
    expect(res.body.length).toBe(1000);
  });

  it('decodes gzip', async () => {
    const res = await safeFetch(`${base}/gzip`, { maxBytes: 1000, policy: LOCAL });
    expect(res.body.toString()).toBe('<p>zipped</p>');
  });

  it.each([
    ['createBrotliDecompress', '/bomb-br'],
    ['createGunzip', '/bomb-gzip'],
  ] as const)('stops the %s decoder once the cap is hit (decompression bomb)', async (factory, path) => {
    const created: { destroyed: boolean }[] = [];
    const original = zlib[factory].bind(zlib) as () => { destroyed: boolean };
    const spy = vi.spyOn(zlib, factory).mockImplementation((() => {
      const stream = original();
      created.push(stream);
      return stream;
    }) as never);
    try {
      await expect(safeFetch(`${base}${path}`, { maxBytes: 1000, policy: LOCAL })).rejects.toBeInstanceOf(ResponseTooLargeError);
      expect(created).toHaveLength(1);
      expect(created[0]?.destroyed).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it('closes the connection after a non-2xx status even if the body trickles on', async () => {
    await expect(safeFetch(`${base}/slow500`, { maxBytes: 1000, policy: LOCAL })).rejects.toBeInstanceOf(UpstreamUnavailableError);
    await expect(
      Promise.race([slowSocketClosed, new Promise((_, reject) => setTimeout(() => reject(new Error('socket still open')), 500))]),
    ).resolves.toBeUndefined();
  });

  it('times out', async () => {
    await expect(safeFetch(`${base}/hang`, { maxBytes: 1000, timeoutMs: 200, policy: LOCAL })).rejects.toThrow(/timed out/);
  });
});

describe('safeFetch with the default (production) policy', () => {
  it.each([
    'http://127.0.0.1/', 'http://[::1]/', 'http://[::ffff:127.0.0.1]/', 'http://2130706433/', 'http://10.0.0.1/',
    'http://169.254.169.254/latest/meta-data/', 'https://example.com:8443/', 'ftp://example.com/', 'file:///etc/passwd',
    'http://user:pw@example.com/', 'not a url',
  ])('blocks %s before connecting', async (url) => {
    await expect(safeFetch(url, { maxBytes: 1000 })).rejects.toBeInstanceOf(BlockedUrlError);
  });

  it('blocks a hostname that resolves to loopback', async () => {
    await expect(safeFetch('http://localhost/', { maxBytes: 1000 })).rejects.toBeInstanceOf(BlockedUrlError);
  });

  it('does not accept a random port even for an allowed address', async () => {
    await expect(safeFetch(`${base}/ok`, { maxBytes: 1000, policy: { isAllowedAddress: () => true } })).rejects.toThrow(/port/);
  });
});
