import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { expectNotPublic, expectPublic, toast } from './admin';
import { getPost, uniqueSlug } from './db';

/**
 * The editor's whole status lifecycle through the real UI: create a draft (lands on the /edit
 * URL), publish (public page shows it), edit + "Uložiť zmeny" (stays put, public page updated at
 * once), archive via "⋯" (public page 404s). Shared by the desktop and phone specs.
 */
export async function postLifecycle(page: Page, request: APIRequestContext): Promise<void> {
  const slug = uniqueSlug('lifecycle');
  const title = `E2E nový príspevok ${slug.slice(-8)}`;
  const editedTitle = `${title} (upravený)`;

  await test.step('create a draft', async () => {
    await page.goto('/admin/posts/new');
    await page.getByLabel('Titulok').fill(title);
    await page.getByLabel('Obsah (Markdown)').fill('Obsah vytvorený **e2e** testom.');
    await page.getByLabel('Slug', { exact: true }).fill(slug);
    await page.getByRole('button', { name: 'Uložiť koncept' }).click();
    await expect(page).toHaveURL(/\/admin\/posts\/\d+\/edit$/);
    await expect(page.getByLabel('Titulok')).toHaveValue(title);
    await expect(page.getByText('Koncept', { exact: true }).first()).toBeVisible();
    expect((await getPost(slug))?.status).toBe('draft');
    await expectNotPublic(request, slug);
  });

  const editUrl = page.url();

  await test.step('publish', async () => {
    await page.getByRole('button', { name: 'Publikovať' }).click();
    await expect(toast(page, 'Príspevok je publikovaný.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Uložiť zmeny' })).toBeVisible();
    await expectPublic(request, slug, title);
  });

  await test.step('edit and save keeps the editor open', async () => {
    await page.getByLabel('Titulok').fill(editedTitle);
    await expect(page.getByText('• Neuložené zmeny')).toBeVisible();
    await page.getByRole('button', { name: 'Uložiť zmeny' }).click();
    await expect(toast(page, 'Uložené.')).toBeVisible();
    await expect(page.getByText('• Neuložené zmeny')).toHaveCount(0);
    expect(page.url()).toBe(editUrl);
    await expectPublic(request, slug, editedTitle);
  });

  await test.step('archive via the ⋯ menu', async () => {
    await page.getByRole('button', { name: 'Ďalšie akcie' }).click();
    await page.getByRole('menuitem', { name: 'Archivovať' }).click();
    await expect(toast(page, 'Príspevok je archivovaný.')).toBeVisible();
    expect((await getPost(slug))?.status).toBe('archived');
    await expectNotPublic(request, slug);
  });
}
