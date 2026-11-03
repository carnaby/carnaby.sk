import { ADMIN_STATE, USER_STATE } from './support/env';
import { expect, test } from './support/test';

test.describe('anonymous visitor', () => {
  test('is sent from /admin to /login', async ({ page }) => {
    await page.goto('/admin/posts');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Prihlásenie' })).toBeVisible();
  });
});

test.describe('signed-in non-admin', () => {
  test.use({ storageState: USER_STATE });

  test('is sent from /admin to the homepage', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('featured-grid')).toBeAttached();
  });
});

test.describe('admin', () => {
  test.use({ storageState: ADMIN_STATE });

  test('gets the admin dashboard', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Ahoj, E2E' })).toBeVisible();
  });
});
