// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { PostListItem } from '../../lib/trpc-server';
import { PostImage } from './post-image';

const createMockPost = (
  overrides: Partial<PostListItem> = {},
): PostListItem => ({
  id: 1,
  slug: 'test-post',
  title: 'Test Post',
  excerpt: 'Test excerpt',
  publishedAt: '2024-01-01T00:00:00Z',
  viewCount: 0,
  isFeatured: false,
  language: 'en',
  categories: [
    {
      slug: 'devlog',
      name: 'DevLog',
    },
  ],
  thumbnailPath: null,
  youtubeId: null,
  ...overrides,
});

describe('PostImage', () => {
  it('renders img with thumbnailPath, srcSet, and loading=lazy', () => {
    const post = createMockPost({
      thumbnailPath: 'test-image.jpg',
    });

    render(<PostImage post={post} width={600} />);

    const img = screen.getByRole('img', { name: 'Test Post' });
    expect(img).toHaveAttribute('src', '/images/600/test-image.jpg');
    expect(img).toHaveAttribute('loading', 'lazy');

    // Verify srcSet includes all three widths
    const srcSet = img.getAttribute('srcSet') || '';
    expect(srcSet).toContain('/images/300/test-image.jpg 300w');
    expect(srcSet).toContain('/images/600/test-image.jpg 600w');
    expect(srcSet).toContain('/images/1200/test-image.jpg 1200w');
  });

  it('renders YouTube thumbnail when youtubeId is present and no thumbnailPath', () => {
    const post = createMockPost({
      youtubeId: 'dQw4w9WgXcQ',
    });

    render(<PostImage post={post} width={600} />);

    const img = screen.getByRole('img', { name: 'Test Post' });
    expect(img).toHaveAttribute('src', 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('renders gradient placeholder when neither thumbnailPath nor youtubeId', () => {
    const post = createMockPost({
      thumbnailPath: null,
      youtubeId: null,
    });

    const { container } = render(<PostImage post={post} width={600} />);

    // Should not render an img tag
    const imgs = screen.queryAllByRole('img');
    expect(imgs).toHaveLength(0);

    // Should render a div with aria-hidden and gradient style
    const div = container.querySelector('div[aria-hidden="true"]');
    expect(div).toBeInTheDocument();
    expect(div).toHaveClass('h-full', 'w-full');
  });

  it('applies className prop to the element', () => {
    const post = createMockPost({
      thumbnailPath: 'test-image.jpg',
    });

    const { container } = render(
      <PostImage post={post} width={600} className="custom-class" />,
    );

    const img = container.querySelector('.custom-class');
    expect(img).toBeInTheDocument();
  });
});
