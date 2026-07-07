import { seedPosts } from './fixtures/seed-posts';

/** Playwright `globalSetup`: runs once before the suite (see `playwright.config.mts`), seeding
 * the dev Postgres database the `webServer`-started api/web processes read from. */
export default async function globalSetup(): Promise<void> {
  await seedPosts();
}
