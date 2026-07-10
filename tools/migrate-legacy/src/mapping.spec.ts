import { describe, expect, it } from 'vitest';
import { buildTranslations, mapPost, mapUser } from './mapping';
import type { LegacyPost, LegacyTranslation, LegacyUser } from './mapping';

function legacyUser(overrides: Partial<LegacyUser> = {}): LegacyUser {
  return {
    id: 1,
    google_id: 'google-id-1',
    email: 'dodusik@gmail.com',
    display_name: 'Dodo',
    avatar_url: 'https://example.com/avatar.png',
    role: 'admin',
    created_at: new Date('2020-01-01T00:00:00Z'),
    ...overrides,
  };
}

function legacyPost(overrides: Partial<LegacyPost> = {}): LegacyPost {
  return {
    id: 1,
    title: 'Legacy Title',
    slug: 'legacy-title',
    content: 'Legacy content',
    excerpt: 'Legacy excerpt',
    thumbnail_path: null,
    youtube_id: null,
    soundcloud_url: null,
    author_id: 1,
    created_at: new Date('2020-01-01T00:00:00Z'),
    updated_at: new Date('2020-01-02T00:00:00Z'),
    published_at: new Date('2020-01-03T00:00:00Z'),
    view_count: 0,
    status: 'published',
    is_featured: false,
    meta_description: null,
    language: 'sk',
    ...overrides,
  };
}

function legacyTranslation(overrides: Partial<LegacyTranslation> = {}): LegacyTranslation {
  return {
    post_id: 1,
    language: 'sk',
    title: 'Translated title',
    content: 'Translated content',
    excerpt: null,
    meta_description: null,
    ...overrides,
  };
}

describe('mapUser', () => {
  it('generates a 32-hex user id and a matching google account row', () => {
    const { user, account, oldId } = mapUser(legacyUser());

    expect(user.id).toMatch(/^[0-9a-f]{32}$/);
    expect(account.id).toMatch(/^[0-9a-f]{32}$/);
    expect(account.id).not.toBe(user.id);
    expect(account.userId).toBe(user.id);
    expect(account.providerId).toBe('google');
    expect(account.accountId).toBe('google-id-1');
    expect(oldId).toBe(1);
  });

  it('uses display_name for name when present', () => {
    const { user } = mapUser(legacyUser({ display_name: 'Dodo Admin' }));
    expect(user.name).toBe('Dodo Admin');
  });

  it('falls back to the email local-part when display_name is null', () => {
    const { user } = mapUser(legacyUser({ display_name: null, email: 'listener@example.com' }));
    expect(user.name).toBe('listener');
  });

  it('preserves role, email, avatar and created_at; forces emailVerified true', () => {
    const createdAt = new Date('2019-06-15T00:00:00Z');
    const { user, account } = mapUser(
      legacyUser({ role: 'user', avatar_url: 'https://example.com/a.png', created_at: createdAt }),
    );
    expect(user.role).toBe('user');
    expect(user.email).toBe('dodusik@gmail.com');
    expect(user.image).toBe('https://example.com/a.png');
    expect(user.emailVerified).toBe(true);
    expect(user.createdAt).toBe(createdAt);
    expect(account.createdAt).toBe(createdAt);
  });

  it('defaults role to "user" when the legacy role column is null', () => {
    const { user } = mapUser(legacyUser({ role: null }));
    expect(user.role).toBe('user');
  });

  it('passes through a null avatar_url as a null image', () => {
    const { user } = mapUser(legacyUser({ avatar_url: null }));
    expect(user.image).toBeNull();
  });
});

describe('mapPost', () => {
  it('strips a legacy directory prefix from thumbnail_path down to the bare filename', () => {
    const post = mapPost(legacyPost({ thumbnail_path: '/thumbnails/originals/x.jpg' }), new Map());
    expect(post.thumbnailPath).toBe('x.jpg');
  });

  it('leaves an already-bare filename untouched', () => {
    const post = mapPost(legacyPost({ thumbnail_path: 'x.jpg' }), new Map());
    expect(post.thumbnailPath).toBe('x.jpg');
  });

  it('strips windows-style backslash directory prefixes regardless of host OS', () => {
    const post = mapPost(legacyPost({ thumbnail_path: 'thumbnails\\originals\\x.jpg' }), new Map());
    expect(post.thumbnailPath).toBe('x.jpg');

    const drivePost = mapPost(legacyPost({ thumbnail_path: 'C:\\uploads\\thumbs\\y.png' }), new Map());
    expect(drivePost.thumbnailPath).toBe('y.png');
  });

  it('maps a null thumbnail_path to null', () => {
    const post = mapPost(legacyPost({ thumbnail_path: null }), new Map());
    expect(post.thumbnailPath).toBeNull();
  });

  it('copies slug/status/is_featured/youtube_id/soundcloud_url/view_count/published_at/created_at', () => {
    const publishedAt = new Date('2021-02-02T00:00:00Z');
    const createdAt = new Date('2021-01-01T00:00:00Z');
    const post = mapPost(
      legacyPost({
        slug: 'my-post',
        status: 'archived',
        is_featured: true,
        youtube_id: 'abc123',
        soundcloud_url: 'https://soundcloud.com/x',
        view_count: 42,
        published_at: publishedAt,
        created_at: createdAt,
      }),
      new Map(),
    );
    expect(post.slug).toBe('my-post');
    expect(post.status).toBe('archived');
    expect(post.isFeatured).toBe(true);
    expect(post.youtubeId).toBe('abc123');
    expect(post.soundcloudUrl).toBe('https://soundcloud.com/x');
    expect(post.viewCount).toBe(42);
    expect(post.publishedAt).toBe(publishedAt);
    expect(post.createdAt).toBe(createdAt);
  });

  it('maps author_id through the provided old->new id map', () => {
    const authorIdMap = new Map([[7, 'new-user-hex-id']]);
    const post = mapPost(legacyPost({ author_id: 7 }), authorIdMap);
    expect(post.authorId).toBe('new-user-hex-id');
  });

  it('maps a missing/unmapped author_id to null', () => {
    const post = mapPost(legacyPost({ author_id: 999 }), new Map());
    expect(post.authorId).toBeNull();
  });

  it('maps a null author_id to null', () => {
    const post = mapPost(legacyPost({ author_id: null }), new Map());
    expect(post.authorId).toBeNull();
  });

  it('falls back to draft for an unrecognized legacy status value', () => {
    const post = mapPost(legacyPost({ status: 'bogus' }), new Map());
    expect(post.status).toBe('draft');
  });
});

describe('buildTranslations', () => {
  it('synthesizes a translation from legacy columns when no row exists for the post language', () => {
    const old = legacyPost({ language: 'sk', title: 'Legacy SK Title', content: 'Legacy SK content' });
    const { translations, warnings } = buildTranslations(old, []);

    expect(translations).toHaveLength(1);
    expect(translations[0]).toMatchObject({
      postId: old.id,
      language: 'sk',
      title: 'Legacy SK Title',
      content: 'Legacy SK content',
    });
    expect(warnings).toHaveLength(0);
  });

  it('lets a real post_translations row win over the synthesized one for the same language', () => {
    const old = legacyPost({ language: 'sk', title: 'Stale legacy title', content: 'Stale legacy content' });
    const rows = [legacyTranslation({ language: 'sk', title: 'Real title', content: 'Real content' })];

    const { translations } = buildTranslations(old, rows);

    expect(translations).toHaveLength(1);
    expect(translations[0]?.title).toBe('Real title');
    expect(translations[0]?.content).toBe('Real content');
  });

  it('does not synthesize when the legacy content is empty', () => {
    const old = legacyPost({ language: 'sk', title: 'Has a title', content: '' });
    const { translations } = buildTranslations(old, []);
    expect(translations).toHaveLength(0);
  });

  it('does not synthesize when the legacy content is null', () => {
    const old = legacyPost({ language: 'sk', title: 'Has a title', content: null });
    const { translations } = buildTranslations(old, []);
    expect(translations).toHaveLength(0);
  });

  it('does not synthesize when the legacy title is empty', () => {
    const old = legacyPost({ language: 'sk', title: '', content: 'Has content' });
    const { translations } = buildTranslations(old, []);
    expect(translations).toHaveLength(0);
  });

  it('copies every real row for supported languages, keeping both sk and en', () => {
    const old = legacyPost({ language: 'sk' });
    const rows = [
      legacyTranslation({ language: 'sk', title: 'SK title', content: 'SK content' }),
      legacyTranslation({ language: 'en', title: 'EN title', content: 'EN content' }),
    ];

    const { translations } = buildTranslations(old, rows);

    expect(translations).toHaveLength(2);
    expect(translations.map((t) => t.language).sort()).toEqual(['en', 'sk']);
  });

  it('normalizes language casing to lowercase', () => {
    // Legacy title/content left empty so the sk-synthesis rule can't add a second entry --
    // this test isolates only the "EN" -> "en" row-language normalization.
    const old = legacyPost({ language: 'sk', title: '', content: '' });
    const rows = [legacyTranslation({ language: 'EN', title: 'EN title', content: 'EN content' })];

    const { translations } = buildTranslations(old, rows);

    expect(translations).toHaveLength(1);
    expect(translations[0]?.language).toBe('en');
  });

  it('skips rows with an unsupported language and reports a warning instead of throwing', () => {
    const old = legacyPost({ language: 'sk', title: '', content: '' });
    const rows = [legacyTranslation({ language: 'cs', title: 'Divny jazyk', content: 'cs content' })];

    const { translations, warnings } = buildTranslations(old, rows);

    expect(translations).toHaveLength(0);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/cs/);
  });

  it('both skips an unsupported-language row and still synthesizes from legacy columns', () => {
    const old = legacyPost({ language: 'sk', title: 'Legacy SK Title', content: 'Legacy SK content' });
    const rows = [legacyTranslation({ language: 'cs', title: 'Divny jazyk', content: 'cs content' })];

    const { translations, warnings } = buildTranslations(old, rows);

    expect(translations).toHaveLength(1);
    expect(translations[0]?.language).toBe('sk');
    expect(translations[0]?.title).toBe('Legacy SK Title');
    expect(warnings).toHaveLength(1);
  });

  it('coalesces a null content on a real translation row to an empty string (v2 content is NOT NULL)', () => {
    // Legacy title/content left empty so the en-synthesis rule can't add a second entry -- this
    // test isolates only the null->'' coalescing on the real sk row.
    const old = legacyPost({ language: 'en', title: '', content: '' });
    const rows = [legacyTranslation({ language: 'sk', title: 'SK title', content: null })];

    const { translations } = buildTranslations(old, rows);

    expect(translations).toHaveLength(1);
    expect(translations[0]?.content).toBe('');
  });

  it('deduplicates multiple rows for the same normalized language, keeping the last one', () => {
    const old = legacyPost({ language: 'sk' });
    const rows = [
      legacyTranslation({ language: 'SK', title: 'First', content: 'first' }),
      legacyTranslation({ language: 'sk', title: 'Second', content: 'second' }),
    ];

    const { translations } = buildTranslations(old, rows);

    expect(translations).toHaveLength(1);
    expect(translations[0]?.title).toBe('Second');
  });
});
