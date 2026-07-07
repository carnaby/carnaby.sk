import { expect, test } from '@playwright/test';

test('homepage renders pillars and featured posts', async ({ page }) => {
  await page.goto('/');

  // Scoped to the pillars section, not the whole page: the site header repeats each category
  // name as a nav link (and the seeded featured post below belongs to the "devlog" category too,
  // so its card's accessible name also contains "DevLog") — an unscoped `getByRole` would match
  // more than one element and fail Playwright's strict-mode check.
  const pillars = page.locator('[data-testid="pillars"]');
  await expect(pillars.getByRole('link', { name: /devlog/i })).toBeVisible();
  await expect(pillars.getByRole('link', { name: /dodo/i })).toBeVisible();
  await expect(pillars.getByRole('link', { name: /carnaby/i })).toBeVisible();

  await expect(page.locator('[data-testid="featured-grid"] article').first()).toBeVisible();
});
