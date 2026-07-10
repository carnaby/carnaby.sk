import { expect, test } from '@playwright/test';

// Neither test below references the local fixture post (`fixtures/seed-posts.ts`) by name --
// the pillar labels are static category names (packages/shared/src/categories.ts) and the
// featured-grid/language-switcher assertions are content-agnostic -- so both run unmodified
// against real production data too (Task 30's external/staging mode, `E2E_BASE_URL` set).

test('homepage renders pillars and featured posts', async ({ page }) => {
  await page.goto('/');

  // Scoped to the pillars section, not the whole page: the site header repeats each category
  // name as a nav link (and a featured post card can belong to the "devlog" category too, so its
  // accessible name also contains "DevLog") — an unscoped `getByRole` would match more than one
  // element and fail Playwright's strict-mode check.
  const pillars = page.locator('[data-testid="pillars"]');
  await expect(pillars.getByRole('link', { name: /devlog/i })).toBeVisible();
  await expect(pillars.getByRole('link', { name: /dodo/i })).toBeVisible();
  await expect(pillars.getByRole('link', { name: /carnaby/i })).toBeVisible();

  await expect(page.locator('[data-testid="featured-grid"] article').first()).toBeVisible();
});

test('language switcher toggles sk -> en on the same page', async ({ page }) => {
  await page.goto('/');

  // Aria-label text (see components/site/language-switcher.tsx + messages/sk.json) rather than a
  // testid: proves the real accessible control works, the same way a screen-reader user or
  // Playwright's own accessibility-tree-based locators would find it.
  await page.getByRole('button', { name: 'Prepnúť na angličtinu' }).click();

  await expect(page).toHaveURL(/\/en\/?$/);
  // Category names are identical strings in both locales (packages/shared/src/categories.ts), so
  // this doubles as proof the page actually re-rendered under the new locale, not just that the
  // URL changed.
  await expect(page.locator('[data-testid="pillars"]').getByRole('link', { name: /devlog/i })).toBeVisible();
});
