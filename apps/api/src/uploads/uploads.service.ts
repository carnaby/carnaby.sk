import { Injectable, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

// Multer only reports the mimetype the client sent, so the mapping below both allowlists the
// four supported image types AND supplies the on-disk extension — the original filename's
// extension (client-controlled) is never trusted.
const ALLOWED_MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

export class UnsupportedMimeTypeError extends Error {}

export class UpstreamNotFoundError extends Error {}

export class UpstreamUnavailableError extends Error {}

export class InvalidImageError extends Error {}

/** Upper bound for images saved from a URL or a base64 payload (MCP tools). */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Widths the `/images/:width/:filename` endpoint serves (and therefore caches). */
export const IMAGE_WIDTHS: readonly number[] = [300, 600, 1200, 1920];

const SHARP_FORMAT_EXTENSIONS: Record<string, string> = { jpeg: 'jpg', png: 'png', gif: 'gif', webp: 'webp' };

/** Detects the real image format from the bytes (never trusts a client-sent mimetype or a URL's
 * extension) and returns the on-disk extension. Throws InvalidImageError for anything sharp
 * can't decode or that isn't one of the four supported formats. */
export async function detectImageExtension(buffer: Buffer): Promise<string> {
  let format: string | undefined;
  try {
    format = (await sharp(buffer).metadata()).format;
  } catch {
    throw new InvalidImageError('file is not a valid image');
  }
  const ext = format ? SHARP_FORMAT_EXTENSIONS[format] : undefined;
  if (!ext) throw new InvalidImageError(`unsupported image format: ${format ?? 'unknown'} (use jpeg, png, gif or webp)`);
  return ext;
}

/** Maps an image mimetype to its on-disk extension; throws for anything outside the allowlist
 * (including a mimetype-shaped string mangled with path separators — it simply won't match). */
export function safeName(mimetype: string): string {
  const ext = ALLOWED_MIME_EXTENSIONS[mimetype];
  if (!ext) throw new UnsupportedMimeTypeError(`unsupported mimetype: ${mimetype}`);
  return ext;
}

export function youtubeThumbFilename(youtubeId: string): string {
  return `yt-${youtubeId}.jpg`;
}

/** Rejects paths that could escape the uploads directory: no slashes (path separators), no
 * leading dots (relative paths), no absolute paths (POSIX or Windows-drive). */
export function isSafeUploadFilename(filename: string): boolean {
  return !/[/\\]/.test(filename) && !filename.startsWith('.') && !filename.startsWith('/') && !/^[a-zA-Z]:/.test(filename);
}

export function uploadsBaseDir(): string {
  return process.env['UPLOADS_DIR'] ?? './.data/uploads';
}

export function cacheBaseDir(): string {
  return process.env['CACHE_DIR'] ?? './.data/cache';
}

function originalsDir(uploadsDir: string): string {
  return path.resolve(uploadsDir, 'originals');
}

/** Resolves `filename` against `${UPLOADS_DIR}/originals`, returning the resolved path only if
 * it stays contained within that directory (defends against traversal via a malformed/hostile
 * filename) — `null` otherwise. */
function resolveContained(uploadsDir: string, filename: string): string | null {
  const base = originalsDir(uploadsDir);
  const target = path.resolve(base, filename);
  if (target !== base && !target.startsWith(base + path.sep)) return null;
  return target;
}

async function writeOriginal(buffer: Buffer, prefix: string, ext: string): Promise<string> {
  const base = originalsDir(uploadsBaseDir());
  await fs.mkdir(base, { recursive: true });
  const filename = `${prefix}-${Date.now()}-${randomBytes(3).toString('hex')}.${ext}`;
  await fs.writeFile(path.join(base, filename), buffer);
  return filename;
}

export async function saveThumbnail(buffer: Buffer, mimetype: string): Promise<string> {
  safeName(mimetype); // fast allowlist check on the claimed type...
  const ext = await detectImageExtension(buffer); // ...then trust only the actual bytes
  return writeOriginal(buffer, 'thumb', ext);
}

/** Saves raw image bytes (e.g. a base64 payload from an MCP tool) as a new original. */
export async function saveImageBuffer(buffer: Buffer, prefix: 'thumb' | 'img' = 'img'): Promise<string> {
  if (buffer.length === 0) throw new InvalidImageError('image is empty');
  if (buffer.length > MAX_IMAGE_BYTES) throw new InvalidImageError(`image too large (max ${MAX_IMAGE_BYTES / 1024 / 1024}MB)`);
  const ext = await detectImageExtension(buffer);
  return writeOriginal(buffer, prefix, ext);
}

/** Downloads an image from a public http(s) URL and saves it as a new original. The size cap
 * is enforced while streaming, so a huge or endless response can't exhaust memory. */
export async function saveImageFromUrl(rawUrl: string, prefix: 'thumb' | 'img' = 'img'): Promise<string> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new InvalidImageError('invalid url');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new InvalidImageError('only http(s) urls are supported');

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(20_000), redirect: 'follow' });
  } catch (error) {
    throw new UpstreamUnavailableError(error instanceof Error ? error.message : 'image download failed');
  }
  if (!res.ok || !res.body) {
    if (res.status === 404) throw new UpstreamNotFoundError('image not found at url');
    throw new UpstreamUnavailableError(`image download failed with status ${res.status}`);
  }
  const declared = Number(res.headers.get('content-length') ?? 0);
  if (declared > MAX_IMAGE_BYTES) throw new InvalidImageError(`image too large (max ${MAX_IMAGE_BYTES / 1024 / 1024}MB)`);

  const chunks: Buffer[] = [];
  let total = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_IMAGE_BYTES) {
      await reader.cancel();
      throw new InvalidImageError(`image too large (max ${MAX_IMAGE_BYTES / 1024 / 1024}MB)`);
    }
    chunks.push(Buffer.from(value));
  }
  return saveImageBuffer(Buffer.concat(chunks), prefix);
}

/** YouTube still qualities, best first. `maxresdefault` (1280×720) only exists for HD uploads;
 * `hqdefault` always exists but is 4:3 with letterbox bars. */
const YOUTUBE_THUMB_QUALITIES = ['maxresdefault', 'sddefault', 'hqdefault'] as const;

export async function fetchYoutubeThumbnail(youtubeId: string): Promise<string> {
  let buffer: Buffer | null = null;
  for (const quality of YOUTUBE_THUMB_QUALITIES) {
    let res: Response;
    try {
      res = await fetch(`https://img.youtube.com/vi/${youtubeId}/${quality}.jpg`, { signal: AbortSignal.timeout(10_000) });
    } catch (error) {
      // Network error or timeout (AbortError)
      throw new UpstreamUnavailableError(error instanceof Error ? error.message : 'youtube fetch failed');
    }
    if (res.ok) {
      buffer = Buffer.from(await res.arrayBuffer());
      break;
    }
    if (res.status !== 404) throw new UpstreamUnavailableError(`youtube fetch failed with status ${res.status}`);
  }
  if (!buffer) throw new UpstreamNotFoundError('youtube thumbnail not found');

  const base = originalsDir(uploadsBaseDir());
  await fs.mkdir(base, { recursive: true });
  const filename = youtubeThumbFilename(youtubeId);
  await fs.writeFile(path.join(base, filename), buffer);
  // Same filename on every re-fetch: drop resized variants so the new still is served.
  await purgeCachedVariants(filename);
  return filename;
}

async function purgeCachedVariants(filename: string): Promise<void> {
  await Promise.all(
    IMAGE_WIDTHS.map((width) =>
      fs.unlink(path.resolve(cacheBaseDir(), String(width), `${filename}.webp`)).catch(() => undefined),
    ),
  );
}

/** True when `filename` is a bare filename that exists in the uploads dir -- same lookup order as
 * the `/images` endpoint: `${UPLOADS_DIR}/originals/<f>`, then `${UPLOADS_DIR}/<f>` (v1 files). */
export async function uploadExists(filename: string): Promise<boolean> {
  if (!isSafeUploadFilename(filename)) return false;
  const uploadsDir = uploadsBaseDir();
  for (const candidate of [resolveContained(uploadsDir, filename), path.resolve(uploadsDir, filename)]) {
    if (!candidate) continue;
    try {
      await fs.access(candidate);
      return true;
    } catch {
      // try next
    }
  }
  return false;
}

/** Best-effort delete of a previously-saved original (thumbnail upload or YouTube fetch).
 * Uses uploadsBaseDir() for the base directory, validates the filename as a bare filename
 * (no path separators or relative traversal), checks containment within the originals directory,
 * and swallows all errors (missing file, fs hiccup) so cleanup never turns a successful record
 * delete into a failed caller-side operation. Standalone (not a class method) so both the tRPC
 * `posts.remove` router and the Nest `UploadsService` share one implementation. */
export async function deleteOriginal(filename: string): Promise<void> {
  if (!isSafeUploadFilename(filename)) return;
  const uploadsDir = uploadsBaseDir();
  const target = resolveContained(uploadsDir, filename);
  if (!target) return;
  try {
    await fs.unlink(target);
  } catch {
    // ignore — best-effort only
  }
  // Resized variants are cached as `${CACHE_DIR}/<width>/<filename>.webp` (images.service.ts);
  // drop them too, otherwise a re-used filename (yt-<id>.jpg) would keep serving the old image.
  await purgeCachedVariants(filename);
}

@Injectable()
export class UploadsService implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    const uploadsDir = uploadsBaseDir();
    const cacheDir = process.env['CACHE_DIR'];
    await fs.mkdir(originalsDir(uploadsDir), { recursive: true });
    if (cacheDir) await fs.mkdir(cacheDir, { recursive: true });
  }

  saveThumbnail(buffer: Buffer, mimetype: string): Promise<string> {
    return saveThumbnail(buffer, mimetype);
  }

  fetchYoutubeThumbnail(youtubeId: string): Promise<string> {
    return fetchYoutubeThumbnail(youtubeId);
  }

  deleteOriginal(filename: string): Promise<void> {
    return deleteOriginal(filename);
  }
}
