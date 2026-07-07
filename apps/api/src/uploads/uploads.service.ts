import { Injectable, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

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

export async function saveThumbnail(buffer: Buffer, mimetype: string): Promise<string> {
  const ext = safeName(mimetype);
  const uploadsDir = uploadsBaseDir();
  const base = originalsDir(uploadsDir);
  await fs.mkdir(base, { recursive: true });
  const filename = `thumb-${Date.now()}-${randomBytes(3).toString('hex')}.${ext}`;
  await fs.writeFile(path.join(base, filename), buffer);
  return filename;
}

export async function fetchYoutubeThumbnail(youtubeId: string): Promise<string> {
  const url = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  } catch (error) {
    // Network error or timeout (AbortError)
    throw new UpstreamUnavailableError(
      error instanceof Error ? error.message : 'youtube fetch failed',
    );
  }

  if (!res.ok) {
    if (res.status === 404) {
      throw new UpstreamNotFoundError('youtube thumbnail not found');
    }
    throw new UpstreamUnavailableError(`youtube fetch failed with status ${res.status}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());

  const uploadsDir = uploadsBaseDir();
  const base = originalsDir(uploadsDir);
  await fs.mkdir(base, { recursive: true });
  const filename = youtubeThumbFilename(youtubeId);
  await fs.writeFile(path.join(base, filename), buffer);
  return filename;
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
