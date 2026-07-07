import { expect, test } from '@playwright/test';

// Fixture post seeded by `global-setup.ts` (`seed-posts.ts`) lives in the `devlog` category —
// see `E2E_FEATURED_SLUG` ('e2e-unique').
test('category page shows the category hero and the fixture post', async ({ page }) => {
  await page.goto('/category/devlog');

  await expect(page.getByRole('heading', { name: /devlog/i })).toBeVisible();
  await expect(page.locator('[data-testid="category-grid"] article')).toContainText(/e2e/i);
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
