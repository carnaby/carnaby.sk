import { expectPublic, toast } from './support/admin';
import { deletePostById, postsByYoutubeId } from './support/db';
import { ADMIN_STATE } from './support/env';
import { FAKE_VIDEOS } from './support/fake-youtube';
import { expect, test } from './support/test';

test.use({ storageState: ADMIN_STATE });

const VIDEO_ID = 'E2EVIDEO001';
const video = FAKE_VIDEOS[VIDEO_ID];

// Needs the api to talk to global-setup's fake YouTube API (YOUTUBE_API_BASE_URL=http://localhost:<port>
// in the repo-root .env, with YOUTUBE_API_KEY/YOUTUBE_CHANNELS set to anything). Never hits real YouTube.
// eslint-disable-next-line playwright/no-skipped-test -- environment-dependent, not a disabled test
test.skip(!process.env['E2E_FAKE_YOUTUBE'], 'fake YouTube API not running (set YOUTUBE_API_BASE_URL=http://localhost:4555)');

test.beforeEach(async () => {
  for (const post of await postsByYoutubeId(VIDEO_ID)) await deletePostById(post.id);
});

test.afterEach(async () => {
  for (const post of await postsByYoutubeId(VIDEO_ID)) await deletePostById(post.id);
});

test('publishing a channel video creates a public post', async ({ page, request }) => {
  await page.goto('/admin/youtube');
  // Bypass the api's 10-minute channel cache so the fake server's list is what we see.
  await page.getByRole('button', { name: 'Obnoviť z YouTube' }).click();
  await page.getByRole('button', { name: /^Všetky/ }).click();
  const row = page.getByRole('row').filter({ hasText: video.title });
  await expect(row).toContainText('Chýba');

  await row.getByRole('button', { name: 'Uverejniť' }).click();
  await expect(toast(page, 'je na webe.')).toBeVisible();
  await expect(row.getByRole('link', { name: 'Upraviť' })).toBeVisible();

  const posts = await postsByYoutubeId(VIDEO_ID);
  expect(posts).toHaveLength(1);
  expect(posts[0]?.status).toBe('published');
  await expectPublic(request, posts[0]?.slug ?? '', video.title);
});
