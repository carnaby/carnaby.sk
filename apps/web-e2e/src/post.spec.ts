import { expect, test } from '@playwright/test';

import { E2E_FEATURED_SLUG } from './fixtures/seed-posts';

// Fixture post seeded by `global-setup.ts` (`seed-posts.ts`): sk+en translations, `devlog`
// category, no thumbnail/youtubeId/soundcloudUrl -- so the post page falls through to the
// gradient-placeholder branch of `PostImage` and never renders the SoundCloud button.
const POST_PATH = `/posts/${E2E_FEATURED_SLUG}`;

test('post page shows the title and body markdown', async ({ page }) => {
  await page.goto(POST_PATH);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('E2E testovací príspevok');
  await expect(page.getByText('Obsah e2e testovacieho príspevku.')).toBeVisible();
});

test('/en/posts/<slug> shows the English translation', async ({ page }) => {
  await page.goto(`/en${POST_PATH}`);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('E2E test post');
  await expect(page.getByText('Body of the e2e test post.')).toBeVisible();
});

async function currentViewCount(page: import('@playwright/test').Page): Promise<number> {
  return Number(await page.getByTestId('view-count').textContent());
}

test('view count increments on repeat visits', async ({ page }) => {
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
