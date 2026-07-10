import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

/**
 * Task 30: pointing the suite at an already-running external deployment (NAS staging,
 * `http://192.168.1.41:3200`, serving real production data) instead of the local dev stack.
 * Setting `E2E_BASE_URL` flips three things at once, all gated on this one var so local-mode
 * behavior (the default -- unset) is completely unchanged:
 *   1. `baseURL` below points at it instead of localhost.
 *   2. `webServer` is omitted entirely below -- there's nothing to launch or reuse, the target is
 *      already running and isn't this repo's dev server.
 *   3. `global-setup.ts` early-returns -- no fixture seeding (there's no throwaway e2e-unique
 *      post on a real deployment) and no local api dev server to health-poll.
 * Individual specs then guard admin/OAuth/fixture-dependent tests with `test.skip` on the same
 * var (see admin-gate.spec.ts, admin-posts.spec.ts, admin-post-editor.spec.ts) and the public
 * specs (home/category/post) swap their fixture-text assertions for real-content-invariant ones
 * instead -- see each file's own doc comment for what changes.
 */
const externalBaseUrl = process.env['E2E_BASE_URL'];
// For CI, you may want to set BASE_URL to the deployed application.
const baseURL = externalBaseUrl || process.env['BASE_URL'] || 'http://localhost:3000';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import 'dotenv/config';

/**
 * See https://playwright.dev/docs/test-configuration.
 *
 * Generated as a .mts file so Node forces ESM regardless of workspace
 * `type`. Playwright routes `.mts` through its ESM loader (dynamic import,
 * bypassing the pirates CJS-compile path), and Nx's native TS strip loads
 * `.mts` directly. Playwright's configLoader auto-discovers
 * `playwright.config.mts` via its extension list
 * (.ts/.js/.mts/.mjs/.cts/.cjs).
 */
const config: PlaywrightTestConfig = {
  ...nxE2EPreset(import.meta.dirname, { testDir: './src' }),
  /* Seeds a featured published post (fixtures/seed-posts.ts) into the dev DB before any test
   * runs — home.spec.ts's featured grid needs at least one to assert against. Early-returns
   * without touching any DB when `E2E_BASE_URL` is set (see doc comment above and the function
   * itself in global-setup.ts). */
  globalSetup: './src/global-setup.ts',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Uncomment for mobile browsers support
    /* {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    }, */

    // Uncomment for branded browsers
    /* {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    } */
  ],
};

/* Starts both the web app (asserted on directly) and the api it calls server-side over
 * `serverTrpc` — reusing an already-running pair (e.g. from `pnpm dev`) instead of relaunching.
 * Next's cold compile on first request can take a while, hence the generous timeout. Omitted
 * entirely in external-mode (`E2E_BASE_URL` set) — see the doc comment at the top of this file. */
if (!externalBaseUrl) {
  config.webServer = {
    command: 'pnpm nx run-many -t dev -p @carnaby/web @carnaby/api',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 180_000,
    cwd: workspaceRoot,
  };
}

export default defineConfig(config);
