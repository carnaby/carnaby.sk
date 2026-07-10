import { expect, test } from '@playwright/test';

import { EXTERNAL_BASE_URL } from './fixtures/env';

/**
 * Admin gate (Task 18): `/admin` is server-gated by `getServerSession()` — an anonymous
 * visitor must never see the admin shell. Full OAuth round-trips can't run here (the dev
 * `.env` ships dummy Google credentials), so these tests cover the anonymous path only;
 * the signed-in admin/non-admin branches are exercised manually at staging.
 *
 * Task 30: skipped entirely in external mode too — a real Google OAuth round-trip against a live
 * deployment needs the redirect URIs registered in Google Cloud Console and a real browser
 * consent flow, neither of which this headless suite can or should automate; see
 * `docs/deploy/cutover-checklist.md` for how that login test actually gets done (locally, or
 * right after cutover on the real domain).
 */
test.beforeEach(() => {
  test.skip(
    Boolean(EXTERNAL_BASE_URL),
    'admin/OAuth specs need the local dev stack -- see playwright.config.mts E2E_BASE_URL doc',
  );
});

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
