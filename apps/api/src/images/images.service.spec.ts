import { BadRequestException, NotFoundException } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';

vi.mock('sharp', async () => {
  const actual = await vi.importActual<typeof import('sharp')>('sharp');
  const spy = vi.fn(actual.default as unknown as (...args: unknown[]) => unknown);
  return { ...actual, default: spy };
});

import { cacheBaseDir, getOrCreate } from './images.service';

describe('getOrCreate', () => {
  let uploadsDir: string;
  let cacheDir: string;
  const originalUploadsEnv = process.env['UPLOADS_DIR'];
  const originalCacheEnv = process.env['CACHE_DIR'];

  beforeEach(async () => {
    uploadsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'carnaby-images-uploads-'));
    cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'carnaby-images-cache-'));
    await fs.mkdir(path.join(uploadsDir, 'originals'), { recursive: true });
    process.env['UPLOADS_DIR'] = uploadsDir;
    process.env['CACHE_DIR'] = cacheDir;

    const png = await sharp({
      create: { width: 2000, height: 1000, channels: 3, background: { r: 100, g: 150, b: 200 } },
    })
      .png()
      .toBuffer();
    await fs.writeFile(path.join(uploadsDir, 'originals', 'photo.png'), png);

    vi.mocked(sharp).mockClear();
  });

  afterEach(async () => {
    if (originalUploadsEnv === undefined) delete process.env['UPLOADS_DIR'];
    else process.env['UPLOADS_DIR'] = originalUploadsEnv;
    if (originalCacheEnv === undefined) delete process.env['CACHE_DIR'];
    else process.env['CACHE_DIR'] = originalCacheEnv;
    await fs.rm(uploadsDir, { recursive: true, force: true });
    await fs.rm(cacheDir, { recursive: true, force: true });
  });

  it('resizes to the requested width and encodes webp, cached under CACHE_DIR/<width>/<filename>.webp', async () => {
    const resultPath = await getOrCreate(300, 'photo.png');

    expect(path.isAbsolute(resultPath)).toBe(true);
    expect(resultPath).toBe(path.resolve(cacheDir, '300', 'photo.png.webp'));

    // Read into a buffer rather than handing sharp the path directly: on Windows, sharp/libvips
    // can keep the file handle open past this call, which makes the temp-dir cleanup in
    // afterEach fail with EBUSY.
    const meta = await sharp(await fs.readFile(resultPath)).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBeLessThanOrEqual(300);
  });

  it('serves the cached file on a second call without re-encoding', async () => {
    const first = await getOrCreate(300, 'photo.png');
    expect(vi.mocked(sharp).mock.calls.length).toBe(1);

    const second = await getOrCreate(300, 'photo.png');
    expect(second).toBe(first);
    expect(vi.mocked(sharp).mock.calls.length).toBe(1);
  });

  it('finds a source file in UPLOADS_DIR root when absent from originals/', async () => {
    const png = await fs.readFile(path.join(uploadsDir, 'originals', 'photo.png'));
    await fs.unlink(path.join(uploadsDir, 'originals', 'photo.png'));
    await fs.writeFile(path.join(uploadsDir, 'root-photo.png'), png);

    const resultPath = await getOrCreate(300, 'root-photo.png');
    const meta = await sharp(await fs.readFile(resultPath)).metadata();
    expect(meta.format).toBe('webp');
  });

  it('rejects an unsupported width', async () => {
    await expect(getOrCreate(500, 'photo.png')).rejects.toThrow(BadRequestException);
    expect(vi.mocked(sharp)).not.toHaveBeenCalled();
  });

  it('rejects a filename with unsafe characters (path traversal)', async () => {
    await expect(getOrCreate(300, '../secret.png')).rejects.toThrow(BadRequestException);
    await expect(getOrCreate(300, 'a/b.png')).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when the source file does not exist', async () => {
    await expect(getOrCreate(300, 'missing.png')).rejects.toThrow(NotFoundException);
  });

  it('returns different cached paths and content for files with same basename but different extensions', async () => {
    // Same basename (same.png and same.jpg) but different content
    const redPng = await sharp({
      create: { width: 2000, height: 1000, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();
    const bluePng = await sharp({
      create: { width: 2000, height: 1000, channels: 3, background: { r: 0, g: 0, b: 255 } },
    })
      .png()
      .toBuffer();

    await fs.writeFile(path.join(uploadsDir, 'same.png'), redPng);
    await fs.writeFile(path.join(uploadsDir, 'same.jpg'), bluePng);

    const pngPath = await getOrCreate(300, 'same.png');
    const jpgPath = await getOrCreate(300, 'same.jpg');

    // Paths must be different
    expect(pngPath).not.toBe(jpgPath);

    // Files must exist
    await expect(fs.access(pngPath)).resolves.toBeUndefined();
    await expect(fs.access(jpgPath)).resolves.toBeUndefined();

    // Content must be different (compare file sizes or buffers)
    const pngBuffer = await fs.readFile(pngPath);
    const jpgBuffer = await fs.readFile(jpgPath);
    expect(pngBuffer).not.toEqual(jpgBuffer);
  });

  it('rejects with BadRequestException when source image is invalid or corrupt', async () => {
    // Write a text file with .png extension
    await fs.writeFile(path.join(uploadsDir, 'broken.png'), 'this is not a real image');

    await expect(getOrCreate(300, 'broken.png')).rejects.toThrow(BadRequestException);
  });
});

describe('cacheBaseDir', () => {
  const originalEnv = process.env['CACHE_DIR'];

  afterEach(() => {
    if (originalEnv === undefined) delete process.env['CACHE_DIR'];
    else process.env['CACHE_DIR'] = originalEnv;
  });

  it('returns the env value when CACHE_DIR is set', () => {
    process.env['CACHE_DIR'] = '/custom/cache';
    expect(cacheBaseDir()).toBe('/custom/cache');
  });

  it("returns the default './.data/cache' when CACHE_DIR is unset", () => {
    delete process.env['CACHE_DIR'];
    expect(cacheBaseDir()).toBe('./.data/cache');
  });
});
