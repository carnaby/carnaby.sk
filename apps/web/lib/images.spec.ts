import { describe, expect, it } from 'vitest';

import { thumbUrl } from './images';

describe('thumbUrl', () => {
  it('builds a URL for a post thumbnail at the requested width', () => {
    expect(thumbUrl('a.png', 600)).toBe('/images/600/a.png');
  });

  it('works with all supported widths', () => {
    expect(thumbUrl('test.jpg', 300)).toBe('/images/300/test.jpg');
    expect(thumbUrl('test.jpg', 600)).toBe('/images/600/test.jpg');
    expect(thumbUrl('test.jpg', 1200)).toBe('/images/1200/test.jpg');
    expect(thumbUrl('test.jpg', 1920)).toBe('/images/1920/test.jpg');
  });
});
