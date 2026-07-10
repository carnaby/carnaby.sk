import { expect, test } from '@playwright/test';

import { createAdminSessionCookie } from './fixtures/admin-session';
import {
  E2E_EDITOR_EDIT_POST_CATEGORY_NAME,
  E2E_EDITOR_EDIT_POST_CONTENT,
  E2E_EDITOR_EDIT_POST_SLUG,
  E2E_EDITOR_EDIT_POST_TITLE,
  E2E_EDITOR_POST_TITLE,
  resetEditorFixturePost,
  seedEditorEditFixturePost,
} from './fixtures/admin-editor-post';

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

/**
 * The `byId` round trip: `/admin/posts/<id>/edit` loads `posts.byId` and hydrates `fromPostById`
 * (`components/admin/post-editor.tsx`) from it. Read-only on purpose -- it never clicks a save
 * button, so `fixtures/admin-editor-post.ts`'s `seedEditorEditFixturePost` row stays stable for
 * every run rather than being mutated by this test itself.
 */
test('editing an existing post round-trips its saved data into the form', async ({ page }) => {
  const { id } = await seedEditorEditFixturePost();
  await page.goto(`/admin/posts/${id}/edit`);

  await expect(page.getByLabel('Slug')).toHaveValue(E2E_EDITOR_EDIT_POST_SLUG);
  // SK tab is active by default -- same unambiguous-label rationale as the create test above.
  await expect(page.getByLabel('Titulok')).toHaveValue(E2E_EDITOR_EDIT_POST_TITLE);
  await expect(page.getByLabel('Obsah (Markdown)')).toHaveValue(E2E_EDITOR_EDIT_POST_CONTENT);

  // Filtered by `checked: true`, not just by name: the dev db has a stray leftover category
  // sharing the exact same display name "DevLog" (`devlog-<timestamp>-...`, from some unrelated
  // prior session -- not created by anything in this repo's e2e suite), so a plain
  // `getByRole('checkbox', { name: ... })` is ambiguous (strict-mode violation, confirmed by
  // actually running this against the current dev db). `seedEditorEditFixturePost` only ever
  // links the canonical `devlog` category to this post, so exactly one "DevLog"-named checkbox
  // is checked regardless of how many same-named stray rows exist.
  await expect(
    page.getByRole('checkbox', { name: E2E_EDITOR_EDIT_POST_CATEGORY_NAME, checked: true }),
  ).toHaveCount(1);

  // Edit mode (as opposed to `/admin/posts/new`) gets all three save actions, including
  // "Archivovať" -- `<PostEditor>` only renders that button when `isEdit`.
  await expect(page.getByRole('button', { name: 'Archivovať' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Uložiť koncept' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publikovať' })).toBeVisible();
});
