import type { Page } from '@playwright/test';

import { deletePost, seedPost, uniqueSlug } from './support/db';
import { expect, test } from './support/test';

// Module-level, so every worker that runs this file seeds (and later deletes) its own pair.
const biSlug = uniqueSlug('public-bi');
const bilingual = {
  slug: biSlug,
  sk: { title: `E2E dvojjazyčný príspevok ${biSlug.slice(-8)}`, content: 'Slovenský obsah e2e príspevku.' },
  en: { title: `E2E bilingual post ${biSlug.slice(-8)}`, content: 'English body of the e2e post.' },
};
const skSlug = uniqueSlug('public-sk');
const skOnly = {
  slug: skSlug,
  sk: { title: `E2E iba po slovensky ${skSlug.slice(-8)}`, content: 'Tento príspevok nemá anglickú verziu.' },
};
const projectSlug = uniqueSlug('public-project');
const withProject = {
  slug: projectSlug,
  projectUrl: 'https://www.example.com/project/',
  sk: { title: `E2E projekt ${projectSlug.slice(-8)}`, content: 'Príspevok o projekte.' },
  en: { title: `E2E project ${projectSlug.slice(-8)}`, content: 'A post about a project.' },
};

test.beforeAll(async () => {
  await seedPost({ ...bilingual, status: 'published', featured: true, category: 'devlog' });
  await seedPost({ ...skOnly, status: 'published', category: 'devlog' });
  await seedPost({ ...withProject, status: 'published', category: 'devlog' });
});

test.afterAll(async () => {
  await deletePost(bilingual.slug);
  await deletePost(skOnly.slug);
  await deletePost(withProject.slug);
});

// Not scoped to <head>: for regular browsers Next 16 streams metadata of dynamic pages, so under
// load the tags can arrive in <body> (crawlers like Googlebot get them blocking, in <head>).
function headHref(page: Page, selector: string) {
  return page.locator(selector).getAttribute('href');
}

test('homepage renders the featured grid with a featured post', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('html')).toHaveAttribute('lang', 'sk');
  await expect(page.getByTestId('featured-grid').getByText(bilingual.sk.title)).toBeVisible();
});

test('SK post page has its own canonical and both hreflang alternates', async ({ page }) => {
  await page.goto(`/posts/${bilingual.slug}`);
  await expect(page.getByRole('heading', { level: 1, name: bilingual.sk.title })).toBeVisible();
  await expect(page.getByText(bilingual.sk.content)).toBeVisible();
  expect(await headHref(page, 'link[rel="canonical"]')).toMatch(new RegExp(`[^/]/posts/${bilingual.slug}$`));
  expect(await headHref(page, 'link[rel="alternate"][hreflang="en"]')).toMatch(new RegExp(`/en/posts/${bilingual.slug}$`));
  expect(await headHref(page, 'link[rel="alternate"][hreflang="sk"]')).toMatch(new RegExp(`[^n]/posts/${bilingual.slug}$`));
});

test('crawlers get the canonical link blocking, inside <head>', async ({ request }) => {
  const response = await request.get(`/posts/${bilingual.slug}`, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
  });
  const html = await response.text();
  const canonicalAt = html.search(new RegExp(`<link rel="canonical" href="[^"]*/posts/${bilingual.slug}"`));
  expect(canonicalAt).toBeGreaterThan(-1);
  expect(canonicalAt).toBeLessThan(html.indexOf('</head>'));
});

test('EN post page renders the English translation with an /en canonical', async ({ page }) => {
  await page.goto(`/en/posts/${bilingual.slug}`);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 1, name: bilingual.en.title })).toBeVisible();
  await expect(page.getByTestId('language-fallback-note')).toHaveCount(0);
  expect(await headHref(page, 'link[rel="canonical"]')).toMatch(new RegExp(`/en/posts/${bilingual.slug}$`));
});

test('/en URL of an SK-only post falls back to SK and canonicalises to the SK URL', async ({ page }) => {
  await page.goto(`/en/posts/${skOnly.slug}`);
  await expect(page.getByRole('heading', { level: 1, name: skOnly.sk.title })).toBeVisible();
  await expect(page.getByTestId('language-fallback-note')).toBeVisible();
  const canonical = await headHref(page, 'link[rel="canonical"]');
  expect(canonical).toMatch(new RegExp(`/posts/${skOnly.slug}$`));
  expect(canonical).not.toContain('/en/');
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(0);
});

test('a post with a project link has a clickable preview and an "Open project" button', async ({ page }) => {
  await page.goto(`/posts/${withProject.slug}`);
  const preview = page.getByTestId('project-preview');
  await expect(preview).toHaveAttribute('href', withProject.projectUrl);
  await expect(preview).toHaveAttribute('target', '_blank');
  await expect(preview).toHaveAttribute('rel', /noopener/);
  const cta = page.getByTestId('project-cta');
  await expect(cta).toHaveAttribute('href', withProject.projectUrl);
  await expect(cta).toContainText('Otvoriť projekt');
  await expect(cta).toContainText('example.com');

  await page.goto(`/en/posts/${withProject.slug}`);
  await expect(page.getByTestId('project-cta')).toContainText('Open project');
});

test('a post without a project link has no project button', async ({ page }) => {
  await page.goto(`/posts/${bilingual.slug}`);
  await expect(page.getByRole('heading', { level: 1, name: bilingual.sk.title })).toBeVisible();
  await expect(page.getByTestId('project-cta')).toHaveCount(0);
  await expect(page.getByTestId('project-preview')).toHaveCount(0);
});

test('category page lists its published posts', async ({ page }) => {
  await page.goto('/category/devlog');
  await expect(page.getByRole('heading', { level: 1, name: 'DevLog' })).toBeVisible();
  await expect(page.getByTestId('category-grid').getByText(bilingual.sk.title)).toBeVisible();
});

test('unknown post slug is a 404', async ({ page }) => {
  const response = await page.goto(`/posts/${uniqueSlug('missing')}`);
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Stránka nenájdená' })).toBeVisible();
});

test('legacy ?language=en links 308-redirect to the /en URL', async ({ request }) => {
  const response = await request.get(`/posts/${bilingual.slug}?language=en`, { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(new URL(response.headers()['location'] ?? '', 'http://x').pathname).toBe(`/en/posts/${bilingual.slug}`);
});

test('sitemap lists only the language versions that exist', async ({ request }) => {
  const response = await request.get('/sitemap.xml');
  expect(response.ok()).toBe(true);
  const xml = await response.text();
  expect(xml).toContain(`/posts/${bilingual.slug}</loc>`);
  expect(xml).toContain(`/en/posts/${bilingual.slug}</loc>`);
  expect(xml).toContain(`/posts/${skOnly.slug}</loc>`);
  expect(xml).not.toContain(`/en/posts/${skOnly.slug}`);
});
