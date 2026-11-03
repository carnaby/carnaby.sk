import type { Page } from '@playwright/test';

import { openPostsFilteredTo, postEntry, toast } from './support/admin';
import { getPost, seedPost, uniqueSlug } from './support/db';
import { ADMIN_STATE } from './support/env';
import { postLifecycle } from './support/lifecycle';
import { expect, test } from './support/test';

// Runs in the "mobile" project only (iPhone 13 viewport, Chromium) -- see playwright.config.ts.
test.use({ storageState: ADMIN_STATE });

const tabBar = (page: Page) => page.getByRole('navigation', { name: 'Administrácia' });

async function seedDraft(tag: string) {
  const slug = uniqueSlug(tag);
  const title = `E2E ${tag} ${slug.slice(-8)}`;
  const { id } = await seedPost({ slug, status: 'draft', sk: { title, content: 'Obsah konceptu.' } });
  return { id, slug, title };
}

test('bottom tab bar is shown on lists and hidden in the editor', async ({ page }) => {
  const post = await seedDraft('tabbar');

  await page.goto('/admin');
  await expect(tabBar(page)).toBeVisible();
  await tabBar(page).getByRole('link', { name: 'Príspevky' }).click();
  await expect(page).toHaveURL(/\/admin\/posts$/);
  await expect(tabBar(page).getByRole('link', { name: 'Príspevky' })).toHaveAttribute('aria-current', 'page');

  await page.goto('/admin/posts/new');
  await expect(page.getByRole('button', { name: 'Publikovať' })).toBeVisible();
  await expect(tabBar(page)).toHaveCount(0);

  await page.goto(`/admin/posts/${post.id}/edit`);
  await expect(page.getByLabel('Titulok')).toHaveValue(post.title);
  await expect(tabBar(page)).toHaveCount(0);
});

test('dashboard "Bez EN" tile opens the filtered list', async ({ page }) => {
  await page.goto('/admin');
  await page.getByRole('link', { name: /Bez EN/ }).click();
  await expect(page).toHaveURL(/\/admin\/posts\?status=published&missing=en$/);
  await expect(page.getByRole('button', { name: 'Bez EN' })).toHaveAttribute('aria-pressed', 'true');
});

test('card star toggles the featured flag', async ({ page }) => {
  const post = await seedDraft('mstar');
  await openPostsFilteredTo(page, post.slug);
  const card = postEntry(page, post.title, true);

  await card.getByRole('button', { name: 'Odporučiť' }).click();
  await expect(card.getByRole('button', { name: 'Zrušiť odporúčanie' })).toHaveAttribute('aria-pressed', 'true');
  expect((await getPost(post.slug))?.isFeatured).toBe(true);
});

test('delete via the card menu removes the post', async ({ page }) => {
  const post = await seedDraft('mdelete');
  await openPostsFilteredTo(page, post.slug);

  await postEntry(page, post.title, true).getByRole('button', { name: 'Ďalšie akcie' }).click();
  await page.getByRole('menuitem', { name: 'Zmazať' }).click();
  await page.getByRole('dialog', { name: 'Zmazať príspevok?' }).getByRole('button', { name: 'Zmazať natrvalo' }).click();

  await expect(toast(page, 'bol zmazaný')).toBeVisible();
  await expect(postEntry(page, post.title, true)).toHaveCount(0);
  expect(await getPost(post.slug)).toBeNull();
});

test('post lifecycle on a phone: draft → publish → edit → archive', async ({ page, request }) => {
  await postLifecycle(page, request);
});
