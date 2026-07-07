import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { uploadsBaseDir } from '../uploads/uploads.service';

const ALLOWED_WIDTHS: readonly number[] = [300, 600, 1200, 1920];
const FILENAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const WEBP_QUALITY = 80;

export function cacheBaseDir(): string {
  return process.env['CACHE_DIR'] ?? './.data/cache';
}

/** Resolves `filename` against the v1 source lookup order: `${UPLOADS_DIR}/originals/<f>` first,
 * then `${UPLOADS_DIR}/<f>`. Throws NotFoundException when neither exists. `filename` is assumed
 * already validated against FILENAME_PATTERN by the caller (no path separators, no traversal). */
async function resolveSource(filename: string): Promise<string> {
  const uploadsDir = uploadsBaseDir();
  const candidates = [path.join(uploadsDir, 'originals', filename), path.join(uploadsDir, filename)];
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // try next candidate
    }
  }
  throw new NotFoundException('image not found');
}

/** Serves the v1 `/images/:width/:filename` contract: validates width/filename, serves a cached
 * WebP if present, otherwise resizes the source with sharp (quality 80, no upscaling), writes it
 * to a temp file and renames it into place (atomic — never serves a partially-written file even
 * under concurrent requests for the same width/filename), and returns the absolute cached path. */
export async function getOrCreate(width: number, filename: string): Promise<string> {
  if (!ALLOWED_WIDTHS.includes(width)) {
    throw new BadRequestException('invalid width');
  }
  if (!FILENAME_PATTERN.test(filename)) {
    throw new BadRequestException('invalid filename');
  }

  const basename = `${path.parse(filename).name}.webp`;
  const cacheDir = path.resolve(cacheBaseDir(), String(width));
  const cachedPath = path.join(cacheDir, basename);

  try {
    await fs.access(cachedPath);
    return cachedPath;
  } catch {
    // not cached yet — fall through to generate it
  }

  const sourcePath = await resolveSource(filename);

  const buffer = await sharp(sourcePath)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  await fs.mkdir(cacheDir, { recursive: true });
  const tempPath = path.join(cacheDir, `.${basename}.${randomBytes(4).toString('hex')}.tmp`);
  await fs.writeFile(tempPath, buffer);
  await fs.rename(tempPath, cachedPath);

  return cachedPath;
}

@Injectable()
export class ImagesService {
  getOrCreate(width: number, filename: string): Promise<string> {
    return getOrCreate(width, filename);
  }
}
