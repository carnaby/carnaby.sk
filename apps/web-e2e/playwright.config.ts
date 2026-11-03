import { defineConfig, devices } from '@playwright/test';

import { BASE_URL, REPO_ROOT } from './src/support/env';

/**
 * Plain Playwright config -- deliberately no `@nx/playwright/preset` / `@nx/devkit` imports
 * (they crash Playwright's loader with "Cannot convert undefined or null to object").
 *
 * Runs against an already-running dev stack (`pnpm dev`: web on :3000, api on :3001) and the
 * Postgres database it uses; global-setup seeds sessions and cleans up `e2e-test-*` posts.
 * Chromium only. `E2E_CHROMIUM_PATH` points at a custom Chromium binary when the one matching
 * this @playwright/test version isn't installed.
 */
const executablePath = process.env['E2E_CHROMIUM_PATH'] || undefined;
const chromium = { browserName: 'chromium' as const, launchOptions: { executablePath } };

export default defineConfig({
  testDir: './src',
  outputDir: `${REPO_ROOT}/dist/.playwright/apps/web-e2e/test-output`,
  globalSetup: './src/global-setup.ts',
  fullyParallel: true,
  workers: process.env['CI'] ? 1 : 3,
  retries: 0,
  forbidOnly: Boolean(process.env['CI']),
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: `${REPO_ROOT}/dist/.playwright/apps/web-e2e/playwright-report` }]],
  use: {
    baseURL: BASE_URL,
    locale: 'sk-SK',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      testIgnore: /\.mobile\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'], ...chromium },
    },
    {
      // iPhone viewport/touch/UA, but rendered by Chromium (devices['iPhone 13'] defaults to WebKit).
      name: 'mobile',
      testMatch: /\.mobile\.spec\.ts$/,
      use: { ...devices['iPhone 13'], ...chromium },
    },
  ],
});
