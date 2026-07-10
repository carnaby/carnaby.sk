import { expect, test } from '@playwright/test';

import { createAdminSessionCookie } from './fixtures/admin-session';
import { E2E_EDITOR_POST_TITLE, resetEditorFixturePost } from './fixtures/admin-editor-post';

/**
 * Task 21: `/admin/posts/new` -- the create half of the bilingual post editor. Extends the same
 * signed-cookie admin auth approach as `admin-posts.spec.ts` (a real Google OAuth round-trip
 * can't run headlessly here).
 *
 * Chromium-only, same rationale as `admin-posts.spec.ts`: this is an admin-only internal tool,
 * and the fixture post here has a single stable (derived-from-title) slug that
 * `resetEditorFixturePost` clears before each run -- running that DB write plus a real create
 * across multiple browser projects in parallel would just be racy for no real coverage gain.
 *
 * Upload buttons (thumbnail file input / "Z YouTube") aren't exercised here -- they need a real
 * file/network round-trip that's better covered manually at staging (per the task brief); their
 * client-side logic (dropping the request state to a toast) is otherwise untested here on
 * purpose, mirroring the brief's own scope call.
 */
test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'admin editor e2e runs on chromium only -- see file doc comment');

  await resetEditorFixturePost();
  const cookie = await createAdminSessionCookie();
  await context.addCookies([{ name: cookie.name, value: cookie.value, url: 'http://localhost:3000' }]);
  await page.goto('/admin/posts/new');
});

test('creating a draft with only the SK tab filled in shows up in the admin posts table', async ({ page }) => {
  // The SK tab is active by default, so these two labels resolve unambiguously -- the EN
  // `TabsContent` panel isn't even mounted while inactive (base-ui `Tabs.Panel` unmounts by
  // default), so there's no risk of matching the wrong tab's identically-labelled field.
  await page.getByLabel('Titulok').fill(E2E_EDITOR_POST_TITLE);
  await page.getByLabel('Obsah (Markdown)').fill('Obsah e2e testovacieho konceptu, iba SK.');

  await page.getByRole('button', { name: 'Uložiť koncept' }).click();

  await expect(page).toHaveURL(/\/admin\/posts$/);
  await expect(page.getByText('Príspevok bol vytvorený.')).toBeVisible();

  const row = page.getByRole('row', { name: new RegExp(E2E_EDITOR_POST_TITLE) });
  await expect(row).toBeVisible();
  // `exact: true` matters here: the fixture title itself contains the substring "koncept"
  // (Slovak for "draft"), so a plain substring/case-insensitive `getByText('Koncept')` would
  // resolve to both the title cell and the status badge (strict-mode violation).
  await expect(row.getByText('Koncept', { exact: true })).toBeVisible();
});
