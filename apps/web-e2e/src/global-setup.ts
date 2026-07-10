import { EXTERNAL_BASE_URL } from './fixtures/env';
import { seedPosts } from './fixtures/seed-posts';

const API_HEALTH_URL = 'http://localhost:3001/api/health';
const API_READY_TIMEOUT_MS = 60_000;
const API_POLL_INTERVAL_MS = 500;

/**
 * Playwright's `webServer` option only waits for the *web* app's port (3000) to answer before
 * handing off to the test run -- it has no visibility into the api process started alongside it
 * (`pnpm nx run-many -t dev -p @carnaby/web @carnaby/api`), which takes longer to come up (build +
 * migrate + Nest bootstrap vs. Next's near-instant dev server). Without this, tests that render
 * server-fetched content (posts, categories) can start running against a web server that's up but
 * still getting `ECONNREFUSED` from every api call, and fail non-deterministically depending on
 * which worker happens to run first.
 */
async function waitForApi(): Promise<void> {
  const deadline = Date.now() + API_READY_TIMEOUT_MS;
  for (;;) {
    try {
      const res = await fetch(API_HEALTH_URL);
      if (res.ok) return;
    } catch {
      // ECONNREFUSED while the api is still building/migrating/bootstrapping -- keep polling.
    }
    if (Date.now() > deadline) {
      throw new Error(`global-setup: api at ${API_HEALTH_URL} did not become ready within ${API_READY_TIMEOUT_MS}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, API_POLL_INTERVAL_MS));
  }
}

/** Playwright `globalSetup`: runs once before the suite (see `playwright.config.mts`), seeding
 * the dev Postgres database the `webServer`-started api/web processes read from, and waiting for
 * the api itself to be reachable (see `waitForApi` above). */
export default async function globalSetup(): Promise<void> {
  // Task 30: external mode (e.g. NAS staging) targets an already-running deployment with real
  // production data -- there's no local dev DB to seed and no local api dev server to health-poll
  // (the api isn't even reachable on localhost:3001 in that case; it's internal-only on the NAS,
  // see docs/deploy/nas-runbook.md). See playwright.config.mts's doc comment for the other two
  // places this same var gates behavior.
  if (EXTERNAL_BASE_URL) return;

  await waitForApi();
  await seedPosts();
}
