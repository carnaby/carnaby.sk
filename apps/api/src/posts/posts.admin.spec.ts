import { describe, expect, it } from 'vitest';
import { isSafeThumbnailPath } from './posts.admin';

describe('isSafeThumbnailPath', () => {
  it('accepts a bare filename', () => {
    expect(isSafeThumbnailPath('thumb-1.jpg')).toBe(true);
  });

  it('rejects paths with forward slashes', () => {
    expect(isSafeThumbnailPath('a/b.jpg')).toBe(false);
  });

  it('rejects paths with backslashes', () => {
    expect(isSafeThumbnailPath('a\\b.jpg')).toBe(false);
  });

  it('rejects paths starting with dot', () => {
    expect(isSafeThumbnailPath('.hidden')).toBe(false);
  });

  it('rejects path traversal attempts', () => {
    expect(isSafeThumbnailPath('../evil')).toBe(false);
  });

  it('rejects absolute paths', () => {
    expect(isSafeThumbnailPath('/etc/passwd')).toBe(false);
    expect(isSafeThumbnailPath('C:\\Windows\\System32')).toBe(false);
  });

  it('accepts filenames with dots in the name', () => {
    expect(isSafeThumbnailPath('my.thumb.file.jpg')).toBe(true);
  });
});
