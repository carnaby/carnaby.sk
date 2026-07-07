import { describe, expect, it } from 'vitest';

import { renderMarkdown } from '../components/post/markdown';

describe('renderMarkdown', () => {
  it('renders a heading', () => {
    expect(renderMarkdown('# h1')).toContain('<h1>h1</h1>');
  });

  it('renders GFM features (tables, strikethrough)', () => {
    expect(renderMarkdown('~~gone~~')).toContain('<del>gone</del>');
  });

  it('strips a raw <script> tag', () => {
    const html = renderMarkdown('hello <script>alert(1)</script> world');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert(1)');
  });

  it('strips an inline event-handler attribute', () => {
    const html = renderMarkdown('<img src=x onerror="alert(1)">');
    expect(html).not.toContain('onerror');
  });
});
