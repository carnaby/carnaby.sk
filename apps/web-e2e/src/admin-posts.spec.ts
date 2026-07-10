import { expect, test } from '@playwright/test';

import { createAdminSessionCookie } from './fixtures/admin-session';
import { E2E_ADMIN_POST_TITLE, seedAdminFixturePost } from './fixtures/admin-post';
import { EXTERNAL_BASE_URL } from './fixtures/env';

/**
 * Task 20: `/admin/posts` table -- full authenticated admin flow (list + delete), not just the
 * anonymous-gate coverage in `admin-gate.spec.ts`.
 *
 * Authenticates by inserting a `user` (role admin) + `session` row directly via drizzle and
 * HMAC-signing the session token the same way better-auth's own cookie signer does (see
 * `fixtures/admin-session.ts`) -- a real Google OAuth round-trip can't run headlessly here (the
 * dev `.env` ships dummy Google credentials).
 *
 * Chromium-only: the fixture post (`fixtures/admin-post.ts`) is a single shared row with a
 * stable slug (upserted, not run-unique -- mirrors `seed-posts.ts`), and this spec deletes it
 * through the real UI. Running that delete across multiple browser projects in parallel would
 * race on that one row; Chromium coverage is sufficient for an admin-only internal tool.
 *
 * `mode: 'serial'` for the same reason within this one project: Playwright runs different tests
 * from the *same* file in different parallel workers by default, and two workers both upserting
 * (or one upserting while another deletes) the same stable-slug row raced on the slug's unique
 * constraint when this was first written -- confirmed by actually running it, not assumed.
 *
 * Task 30: skipped entirely in external mode (`E2E_BASE_URL` set) -- there's no drizzle access to
 * a staging DB from here to seed/authenticate against, and this is an admin-only internal tool
 * exercised manually at staging per the task brief, not headlessly.
 */
test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page, context, browserName }) => {
  test.skip(
    Boolean(EXTERNAL_BASE_URL),
    'admin CRUD e2e needs the local dev stack (direct DB fixture access + signed session cookie) -- see playwright.config.mts E2E_BASE_URL doc',
  );
  test.skip(browserName !== 'chromium', 'admin CRUD e2e runs on chromium only -- see file doc comment');

  await seedAdminFixturePost();
  const cookie = await createAdminSessionCookie();
  await context.addCookies([{ name: cookie.name, value: cookie.value, url: 'http://localhost:3000' }]);
  await page.goto('/admin/posts');
});

test('admin sees the fixture post row and can delete it', async ({ page }) => {
  const row = page.getByRole('row', { name: new RegExp(E2E_ADMIN_POST_TITLE) });
  await expect(row).toBeVisible();
  await expect(row.getByText('Koncept')).toBeVisible();

  await row.getByRole('button', { name: 'Zmazať' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /zmazať príspevok/i }).click();

  // Toast confirms which post was deleted -- also proves `posts.remove` actually resolved rather
  // than the row just optimistically disappearing.
  await expect(page.getByText(new RegExp(`${E2E_ADMIN_POST_TITLE}.*zmazan`, 'i'))).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(E2E_ADMIN_POST_TITLE) })).toHaveCount(0);
});

test('status filter narrows the table to the matching status', async ({ page }) => {
  const row = page.getByRole('row', { name: new RegExp(E2E_ADMIN_POST_TITLE) });
  await expect(row).toBeVisible();

  await page.getByRole('combobox', { name: /stav/i }).click();
  await page.getByRole('option', { name: 'Publikované' }).click();

  // The fixture post is a draft, so it must drop out of a "published only" view.
  await expect(page.getByRole('row', { name: new RegExp(E2E_ADMIN_POST_TITLE) })).toHaveCount(0);
});
