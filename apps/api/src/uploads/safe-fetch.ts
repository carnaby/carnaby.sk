import { lookup as dnsLookup, type LookupAddress, type LookupOptions } from 'node:dns';
import http, { type IncomingMessage } from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';
import type { Readable } from 'node:stream';
import zlib from 'node:zlib';

import { isPublicAddress } from './address-policy';
import { BlockedUrlError, ResponseTooLargeError, UpstreamNotFoundError, UpstreamUnavailableError } from './errors';

/** What the fetch may contact. Production uses the defaults; tests relax them for a local server. */
export interface UrlPolicy {
  /** Which resolved (or literal) IPs may be contacted. Default: `isPublicAddress`. */
  isAllowedAddress?: (ip: string) => boolean;
  /** Default false: only the scheme's default port (80/443). */
  allowAnyPort?: boolean;
}

export interface SafeFetchOptions {
  maxBytes: number;
  /** true: stop reading at `maxBytes` and return what arrived. false (default): throw ResponseTooLargeError. */
  truncate?: boolean;
  accept?: string;
  /** For the whole call, redirects included. Default 10 s. */
  timeoutMs?: number;
  /** Default 3. */
  maxRedirects?: number;
  policy?: UrlPolicy;
}

export interface SafeFetchResult {
  /** Final URL after redirects. */
  url: URL;
  contentType: string;
  body: Buffer;
}

const USER_AGENT = 'Mozilla/5.0 (compatible; carnaby.sk link preview; +https://carnaby.sk)';

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

/** DNS lookup used for the actual connection: every address the host resolves to must be allowed,
 * so a rebinding DNS answer can't slip an internal address in between a check and the connect. */
function guardedLookup(isAllowed: (ip: string) => boolean) {
  return (hostname: string, options: LookupOptions, callback: LookupCallback): void => {
    dnsLookup(hostname, { ...options, all: true as const }, (err, addresses) => {
      if (err) return callback(err, '');
      if (addresses.length === 0 || addresses.some((a) => !isAllowed(a.address))) {
        return callback(new BlockedUrlError(`${hostname} resolves to a non-public address`), '');
      }
      if (options.all) return callback(null, addresses);
      const first = addresses[0];
      if (!first) return callback(new BlockedUrlError(`${hostname} did not resolve`), '');
      callback(null, first.address, first.family);
    });
  };
}

function checkUrl(raw: string, base: URL | undefined, policy: UrlPolicy): URL {
  let url: URL;
  try {
    url = new URL(raw, base);
  } catch {
    throw new BlockedUrlError('invalid url');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new BlockedUrlError(`${url.protocol} urls are not allowed`);
  if (url.username || url.password) throw new BlockedUrlError('urls with credentials are not allowed');
  if (url.port !== '' && !policy.allowAnyPort) throw new BlockedUrlError(`port ${url.port} is not allowed`);
  // Literal IPs never go through `lookup`, so they are checked here. WHATWG URL already turned
  // tricks like http://2130706433/ into 127.0.0.1.
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) && !(policy.isAllowedAddress ?? isPublicAddress)(host)) {
    throw new BlockedUrlError(`${host} is not a public address`);
  }
  return url;
}

function decoded(res: IncomingMessage): Readable {
  const encoding = String(res.headers['content-encoding'] ?? '').trim().toLowerCase();
  if (encoding === 'gzip' || encoding === 'x-gzip') return res.pipe(zlib.createGunzip());
  if (encoding === 'deflate') return res.pipe(zlib.createInflate());
  if (encoding === 'br') return res.pipe(zlib.createBrotliDecompress());
  return res;
}

function asFetchError(error: unknown): Error {
  if (
    error instanceof BlockedUrlError || error instanceof ResponseTooLargeError ||
    error instanceof UpstreamNotFoundError || error instanceof UpstreamUnavailableError
  ) {
    return error;
  }
  return new UpstreamUnavailableError(error instanceof Error ? error.message : 'download failed');
}

type Hop = { kind: 'redirect'; location: string } | { kind: 'done'; result: SafeFetchResult };

function fetchOnce(url: URL, options: SafeFetchOptions, policy: UrlPolicy, deadline: number): Promise<Hop> {
  return new Promise<Hop>((resolve, reject) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return reject(new UpstreamUnavailableError('request timed out'));

    let settled = false;
    let incoming: IncomingMessage | undefined;
    let decoder: Readable | undefined;
    // On every way out (result, error, cap, timeout, redirect) stop the decoder and close the
    // socket, so nothing keeps inflating or trickling after the call has returned.
    const teardown = () => {
      decoder?.destroy();
      incoming?.destroy();
      req.destroy();
    };
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
      teardown();
    };
    const fail = (error: unknown) => settle(() => reject(asFetchError(error)));

    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(url, {
      method: 'GET',
      agent: false,
      lookup: guardedLookup(policy.isAllowedAddress ?? isPublicAddress),
      headers: { 'user-agent': USER_AGENT, accept: options.accept ?? '*/*', 'accept-encoding': 'gzip, deflate, br' },
    });
    const timer = setTimeout(() => {
      fail(new UpstreamUnavailableError('request timed out'));
    }, remaining);
    req.on('error', fail);

    req.on('response', (res) => {
      incoming = res;
      res.on('error', fail);
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        const location = res.headers.location;
        settle(() => resolve({ kind: 'redirect', location }));
        return;
      }
      if (status < 200 || status >= 300) {
        if (status === 404 || status === 410) return fail(new UpstreamNotFoundError(`not found (status ${status})`));
        return fail(new UpstreamUnavailableError(`download failed with status ${status}`));
      }
      const declared = Number(res.headers['content-length'] ?? 0);
      if (!options.truncate && declared > options.maxBytes) {
        return fail(new ResponseTooLargeError(`response too large (max ${options.maxBytes} bytes)`));
      }

      const chunks: Buffer[] = [];
      let total = 0;
      const done = () =>
        settle(() =>
          resolve({ kind: 'done', result: { url, contentType: String(res.headers['content-type'] ?? ''), body: Buffer.concat(chunks) } }),
        );
      const body = (decoder = decoded(res));
      body.on('data', (chunk: Buffer) => {
        if (settled) return;
        const room = options.maxBytes - total;
        if (chunk.length > room) {
          if (options.truncate) {
            chunks.push(chunk.subarray(0, room));
            total += room;
            done();
          } else {
            fail(new ResponseTooLargeError(`response too large (max ${options.maxBytes} bytes)`));
          }
          return;
        }
        chunks.push(chunk);
        total += chunk.length;
      });
      body.on('end', done);
      body.on('error', fail);
    });
    req.end();
  });
}

/**
 * GET for URLs that come from users (MCP, admin editor): http(s) on default ports only, every address
 * the host resolves to must be public (checked in the connection's own DNS lookup), redirects are
 * followed manually and re-checked, one deadline for the whole call, body capped while streaming.
 */
export async function safeFetch(rawUrl: string, options: SafeFetchOptions): Promise<SafeFetchResult> {
  const policy = options.policy ?? {};
  const deadline = Date.now() + (options.timeoutMs ?? 10_000);
  const maxRedirects = options.maxRedirects ?? 3;
  let url = checkUrl(rawUrl, undefined, policy);
  for (let redirects = 0; ; redirects++) {
    const hop = await fetchOnce(url, options, policy, deadline);
    if (hop.kind === 'done') return hop.result;
    if (redirects >= maxRedirects) throw new BlockedUrlError(`too many redirects (max ${maxRedirects})`);
    url = checkUrl(hop.location, url, policy);
  }
}
