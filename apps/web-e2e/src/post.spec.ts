import { expect, test } from '@playwright/test';

import { EXTERNAL_BASE_URL } from './fixtures/env';
import { E2E_FEATURED_SLUG } from './fixtures/seed-posts';

// Fixture post seeded by `global-setup.ts` (`seed-posts.ts`): sk+en translations, `devlog`
// category, no thumbnail/youtubeId/soundcloudUrl -- so the post page falls through to the
// gradient-placeholder branch of `PostImage` and never renders the SoundCloud button.
//
// Task 30: the three tests below all assert on that fixture, which only exists in local mode
// (`global-setup.ts` seeds it before the suite runs) -- it's never present on a real deployment
// like NAS staging. Skipped whenever `E2E_BASE_URL` is set; the fourth test in this file (`a real
// post page loads ...`) is the real-content-invariant replacement that runs unconditionally,
// including against staging's real production data.
const POST_PATH = `/posts/${E2E_FEATURED_SLUG}`;

test('post page shows the title and body markdown', async ({ page }) => {
  test.skip(Boolean(EXTERNAL_BASE_URL), 'fixture post only exists in local mode -- see file doc comment');
  await page.goto(POST_PATH);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('E2E testovací príspevok');
  await expect(page.getByText('Obsah e2e testovacieho príspevku.')).toBeVisible();
});

test('/en/posts/<slug> shows the English translation', async ({ page }) => {
  test.skip(Boolean(EXTERNAL_BASE_URL), 'fixture post only exists in local mode -- see file doc comment');
  await page.goto(`/en${POST_PATH}`);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('E2E test post');
  await expect(page.getByText('Body of the e2e test post.')).toBeVisible();
});

async function currentViewCount(page: import('@playwright/test').Page): Promise<number> {
  return Number(await page.getByTestId('view-count').textContent());
}

test('view count increments on repeat visits', async ({ page }) => {
  test.skip(Boolean(EXTERNAL_BASE_URL), 'fixture post only exists in local mode -- see file doc comment');
  await page.goto(POST_PATH);
  const initial = await currentViewCount(page);

  // The post page's SSR read is cached for 5 minutes (see `lib/trpc-server.ts`'s `tagsFor`), so a
  // plain reload wouldn't reflect the increment on its own -- `ViewTracker` (a client component)
  // fires the increment from a `useEffect` and swaps in the count the mutation itself returns,
  // shortly after mount. `expect.poll` waits for that swap instead of assuming a fixed delay.
  await expect.poll(() => currentViewCount(page), { timeout: 15_000 }).toBeGreaterThan(initial);
  const afterFirstVisit = await currentViewCount(page);

  await page.reload();
  await expect.poll(() => currentViewCount(page), { timeout: 15_000 }).toBeGreaterThan(afterFirstVisit);
});

/**
 * Real-content invariant (Task 30): runs unconditionally, local or external. Follows a real link
 * off the homepage's featured grid rather than hardcoding a slug, so it exercises the exact same
 * path a real visitor takes -- meaningful evidence on staging's real production data, not just
 * the local fixture (which this same flow would click through to, in local mode).
 */
test('a real post page loads via a link click from the homepage', async ({ page }) => {
  await page.goto('/');

  const firstCard = page.locator('[data-testid="featured-grid"] article').first();
  await expect(firstCard).toBeVisible();
  await firstCard.getByRole('link').click();

  await expect(page).toHaveURL(/\/posts\/[^/]+$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByTestId('view-count')).toBeVisible();
});
