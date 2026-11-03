import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';

/**
 * The posts list renders cards below `md` and a table from `md` up (the other one is
 * `display:none`, so role queries only ever see the visible variant).
 */
export function postEntry(page: Page, title: string, isMobile: boolean): Locator {
  return isMobile
    ? page.getByRole('listitem').filter({ has: page.getByRole('link', { name: `Upraviť: ${title}` }) })
    : page.getByRole('row').filter({ hasText: title });
}

/** Opens `/admin/posts` narrowed to one post via the search box (keeps tests independent of
 * whatever else is in the database). */
export async function openPostsFilteredTo(page: Page, slug: string): Promise<void> {
  await page.goto('/admin/posts');
  await page.getByRole('searchbox', { name: 'Hľadať' }).fill(slug);
  await expect(page).toHaveURL(new RegExp(`[?&]q=${slug}`));
}

export function toast(page: Page, text: string): Locator {
  return page.locator('[data-sonner-toast]').filter({ hasText: text });
}

export async function expectPublic(request: APIRequestContext, slug: string, title: string): Promise<void> {
  const response = await request.get(`/posts/${slug}`);
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain(title);
}

export async function expectNotPublic(request: APIRequestContext, slug: string): Promise<void> {
  const response = await request.get(`/posts/${slug}`);
  expect(response.status()).toBe(404);
}
