import { expect, test } from '@playwright/test';

import { EXTERNAL_BASE_URL } from './fixtures/env';

// Real-content invariant (Task 30): runs unconditionally, local or external -- a category page
// with real production data always has at least one article, same as a category page carrying
// only the local fixture post does.
test('category page shows the category hero and at least one post', async ({ page }) => {
  await page.goto('/category/devlog');

  await expect(page.getByRole('heading', { name: /devlog/i })).toBeVisible();
  await expect(page.locator('[data-testid="category-grid"] article').first()).toBeVisible();
});

test('category page shows the local fixture post', async ({ page }) => {
  // `global-setup.ts` (`fixtures/seed-posts.ts`) seeds a stable fixture post into this exact
  // category (`E2E_FEATURED_SLUG`, 'e2e-unique') only in local mode -- it doesn't exist on a real
  // deployment like NAS staging, where the test above stands in as the real-content-invariant
  // replacement (Task 30).
  test.skip(Boolean(EXTERNAL_BASE_URL), 'fixture post only exists in local mode -- see test doc comment');
  await page.goto('/category/devlog');

  // `.filter(...)` narrows to the one matching card rather than asserting on the whole
  // collection's text: the local dev db now also holds real migrated posts in this category
  // alongside the fixture (Task 29), so a plain `toContainText` on the un-filtered multi-element
  // locator is a Playwright strict-mode violation (count-agnostic fix, Task 30).
  await expect(
    page.locator('[data-testid="category-grid"] article').filter({ hasText: /e2e/i }),
  ).toBeVisible();
});

test('/category/dev redirects to /category/devlog (v1 slug parity)', async ({ page }) => {
  await page.goto('/category/dev');

  await expect(page).toHaveURL(/\/category\/devlog$/);
  await expect(page.getByRole('heading', { name: /devlog/i })).toBeVisible();
});

test('unknown category slug 404s', async ({ page }) => {
  const response = await page.goto('/category/nope');

  expect(response?.status()).toBe(404);
});
