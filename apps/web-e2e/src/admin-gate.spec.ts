import { expect, test } from '@playwright/test';

/**
 * Admin gate (Task 18): `/admin` is server-gated by `getServerSession()` — an anonymous
 * visitor must never see the admin shell. Full OAuth round-trips can't run here (the dev
 * `.env` ships dummy Google credentials), so these tests cover the anonymous path only;
 * the signed-in admin/non-admin branches are exercised manually at staging.
 */

test('anonymous /admin redirects to /login with Google sign-in visible', async ({ page }) => {
  await page.goto('/admin');

  // The admin layout redirect()s before rendering anything, so the browser must land on the
  // (Slovak-default, unprefixed) login page.
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: /google/i })).toBeVisible();
});

test('/login shows the Google sign-in button', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByRole('button', { name: /prihlásiť sa cez google/i })).toBeVisible();
});
