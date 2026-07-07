import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  deleteOriginal,
  isSafeUploadFilename,
  safeName,
  UnsupportedMimeTypeError,
  youtubeThumbFilename,
} from './uploads.service';

describe('safeName', () => {
  it('maps allowed mimetypes to their extension', () => {
    expect(safeName('image/jpeg')).toBe('jpg');
    expect(safeName('image/png')).toBe('png');
    expect(safeName('image/gif')).toBe('gif');
    expect(safeName('image/webp')).toBe('webp');
  });

  it('rejects mimetypes outside the allowlist', () => {
    expect(() => safeName('image/svg+xml')).toThrow(UnsupportedMimeTypeError);
    expect(() => safeName('application/pdf')).toThrow(UnsupportedMimeTypeError);
  });

  it('rejects mimetype-like strings containing path separators', () => {
    expect(() => safeName('image/jpeg/../../etc')).toThrow(UnsupportedMimeTypeError);
    expect(() => safeName('image\\jpeg')).toThrow(UnsupportedMimeTypeError);
  });
});

describe('youtubeThumbFilename', () => {
  it('builds the yt-<id>.jpg filename', () => {
    expect(youtubeThumbFilename('abc123')).toBe('yt-abc123.jpg');
  });
});

describe('isSafeUploadFilename', () => {
  it('accepts a bare filename', () => {
    expect(isSafeUploadFilename('thumb-1.jpg')).toBe(true);
  });

  it('rejects paths with forward slashes', () => {
    expect(isSafeUploadFilename('a/b.jpg')).toBe(false);
  });

  it('rejects paths with backslashes', () => {
    expect(isSafeUploadFilename('a\\b.jpg')).toBe(false);
  });

  it('rejects paths starting with dot', () => {
    expect(isSafeUploadFilename('.hidden')).toBe(false);
  });

  it('rejects path traversal attempts', () => {
    expect(isSafeUploadFilename('../evil')).toBe(false);
  });

  it('rejects absolute paths', () => {
    expect(isSafeUploadFilename('/etc/passwd')).toBe(false);
    expect(isSafeUploadFilename('C:\\Windows\\System32')).toBe(false);
  });

  it('accepts filenames with dots in the name', () => {
    expect(isSafeUploadFilename('my.thumb.file.jpg')).toBe(true);
  });
});

describe('deleteOriginal', () => {
  let dir: string;
  const originalEnv = process.env['UPLOADS_DIR'];

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'carnaby-uploads-'));
    await fs.mkdir(path.join(dir, 'originals'), { recursive: true });
    process.env['UPLOADS_DIR'] = dir;
  });

  afterEach(async () => {
    process.env['UPLOADS_DIR'] = originalEnv;
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('deletes an existing file', async () => {
    const target = path.join(dir, 'originals', 'thumb-1.jpg');
    await fs.writeFile(target, 'data');
    await deleteOriginal('thumb-1.jpg');
    await expect(fs.access(target)).rejects.toThrow();
  });

  it('ignores missing files', async () => {
    await expect(deleteOriginal('does-not-exist.jpg')).resolves.toBeUndefined();
  });

  it('ignores path traversal attempts without touching the filesystem', async () => {
    const outside = path.join(dir, 'escaped.txt');
    await fs.writeFile(outside, 'do not delete me');
    await deleteOriginal('../escaped.txt');
    await expect(fs.access(outside)).resolves.toBeUndefined();
  });

  it('is a no-op when UPLOADS_DIR is unset', async () => {
    delete process.env['UPLOADS_DIR'];
    await expect(deleteOriginal('thumb-1.jpg')).resolves.toBeUndefined();
  });
});
