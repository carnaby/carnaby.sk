import { openPostsFilteredTo, postEntry, toast } from './support/admin';
import { getPost, seedPost, uniqueSlug } from './support/db';
import { ADMIN_STATE } from './support/env';
import { postLifecycle } from './support/lifecycle';
import { expect, test } from './support/test';

test.use({ storageState: ADMIN_STATE });

async function seedDraft(tag: string) {
  const slug = uniqueSlug(tag);
  const title = `E2E ${tag} ${slug.slice(-8)}`;
  const { id } = await seedPost({ slug, status: 'draft', sk: { title, content: 'Obsah konceptu.' } });
  return { id, slug, title };
}

test('dashboard tiles link to the filtered posts list', async ({ page }) => {
  await page.goto('/admin');
  await page.getByRole('link', { name: /Bez EN/ }).click();
  await expect(page).toHaveURL(/\/admin\/posts\?status=published&missing=en$/);
  await expect(page.getByRole('button', { name: 'Bez EN' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Publikované' })).toHaveAttribute('aria-pressed', 'true');

  await page.goto('/admin');
  await page.getByRole('link', { name: /Koncepty/ }).click();
  await expect(page).toHaveURL(/\/admin\/posts\?status=draft$/);
});

test('search and chip filters are reflected in the URL', async ({ page }) => {
  const post = await seedDraft('filters');
  await openPostsFilteredTo(page, post.slug);
  const entry = postEntry(page, post.title, false);
  await expect(entry).toHaveCount(1);

  await page.getByRole('button', { name: 'Koncept', exact: true }).click();
  await expect(page).toHaveURL(/[?&]status=draft/);
  await expect(page).toHaveURL(new RegExp(`[?&]q=${post.slug}`));
  await expect(entry).toHaveCount(1);

  await page.getByRole('button', { name: 'Publikované', exact: true }).click();
  await expect(page).toHaveURL(/[?&]status=published/);
  await expect(page.getByText('Filtru nevyhovuje žiadny príspevok.')).toBeVisible();

  await page.getByRole('button', { name: 'Všetky', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/posts\\?q=${post.slug}$`));
  await expect(entry).toHaveCount(1);

  await page.getByRole('searchbox', { name: 'Hľadať' }).fill('');
  await expect(page).toHaveURL(/\/admin\/posts$/);
});

test('"Zrušiť filtre" without an active search clears the chips', async ({ page }) => {
  await page.goto('/admin/posts?status=draft&missing=en');
  await expect(page.getByRole('button', { name: 'Bez EN' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Zrušiť filtre' }).click();
  await expect(page).toHaveURL(/\/admin\/posts$/);
  await expect(page.getByRole('button', { name: 'Všetky', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

// Regression: with a search active, "Zrušiť filtre" used to be undone by the search box's
// 300 ms debounce firing with the *old* params whenever the navigation took longer than the
// debounce (common in `next dev`). Slowed RSC responses make the race deterministic.
test('"Zrušiť filtre" with an active search clears everything', async ({ page }) => {
  const post = await seedDraft('clear');
  await page.goto(`/admin/posts?status=draft&q=${post.slug}`);
  await expect(page.getByRole('searchbox', { name: 'Hľadať' })).toHaveValue(post.slug);
  await expect(postEntry(page, post.title, false)).toHaveCount(1);

  await page.route(
    (url) => url.searchParams.has('_rsc'),
    async (route) => {
      await new Promise((r) => setTimeout(r, 1000));
      await route.continue().catch(() => undefined);
    },
  );
  await page.getByRole('button', { name: 'Zrušiť filtre' }).click();
  await expect(page).toHaveURL(/\/admin\/posts$/, { timeout: 5000 });
  // Give the stale debounce time to fire and the resulting navigation time to land.
  // eslint-disable-next-line playwright/no-wait-for-timeout -- asserting the URL *stays* put
  await page.waitForTimeout(2500);
  await expect(page).toHaveURL(/\/admin\/posts$/, { timeout: 1000 });
});

test('star toggles the featured flag from the table', async ({ page }) => {
  const post = await seedDraft('star');
  await openPostsFilteredTo(page, post.slug);
  const entry = postEntry(page, post.title, false);

  await entry.getByRole('button', { name: 'Odporučiť' }).click();
  await expect(toast(page, 'je odporúčaný')).toBeVisible();
  await expect(entry.getByRole('button', { name: 'Zrušiť odporúčanie' })).toHaveAttribute('aria-pressed', 'true');
  expect((await getPost(post.slug))?.isFeatured).toBe(true);

  await entry.getByRole('button', { name: 'Zrušiť odporúčanie' }).click();
  await expect(entry.getByRole('button', { name: 'Odporučiť' })).toHaveAttribute('aria-pressed', 'false');
  expect((await getPost(post.slug))?.isFeatured).toBe(false);
});

test('delete via the row menu removes the post', async ({ page }) => {
  const post = await seedDraft('delete');
  await openPostsFilteredTo(page, post.slug);

  await postEntry(page, post.title, false).getByRole('button', { name: 'Ďalšie akcie' }).click();
  await page.getByRole('menuitem', { name: 'Zmazať' }).click();
  const dialog = page.getByRole('dialog', { name: 'Zmazať príspevok?' });
  await expect(dialog).toContainText(post.title);
  await dialog.getByRole('button', { name: 'Zmazať natrvalo' }).click();

  await expect(toast(page, 'bol zmazaný')).toBeVisible();
  await expect(postEntry(page, post.title, false)).toHaveCount(0);
  expect(await getPost(post.slug)).toBeNull();
});

test('back arrow asks before discarding unsaved changes', async ({ page }) => {
  const post = await seedDraft('unsaved');
  await page.goto(`/admin/posts/${post.id}/edit`);
  await expect(page.getByLabel('Titulok')).toHaveValue(post.title);

  let prompts = 0;
  page.on('dialog', () => prompts++);

  await page.getByLabel('Titulok').fill(`${post.title} zmena`);
  page.once('dialog', (dialog) => {
    expect(dialog.message()).toContain('neuložené zmeny');
    void dialog.dismiss();
  });
  await page.getByRole('link', { name: 'Späť na príspevky' }).click();
  await expect.poll(() => prompts).toBe(1);
  await expect(page).toHaveURL(new RegExp(`/admin/posts/${post.id}/edit$`));

  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('link', { name: 'Späť na príspevky' }).click();
  await expect(page).toHaveURL(/\/admin\/posts$/);
  expect(prompts).toBe(2);
  // Nothing was saved.
  await openPostsFilteredTo(page, post.slug);
  await expect(postEntry(page, post.title, false)).toHaveCount(1);
});

test('post lifecycle: draft → publish → edit → archive', async ({ page, request }) => {
  await postLifecycle(page, request);
});
