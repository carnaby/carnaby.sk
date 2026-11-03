import { resolve } from 'node:path';

import { config as loadEnv } from 'dotenv';

/** Repo root, computed from this file's location (no `@nx/devkit` -- see playwright.config.ts). */
export const REPO_ROOT = resolve(__dirname, '../../../..');

// The repo-root `.env` holds BETTER_AUTH_SECRET / DATABASE_URL / YOUTUBE_*; values already set in
// the environment win (dotenv's default), so CI or a shell can override any of them.
loadEnv({ path: resolve(REPO_ROOT, '.env'), quiet: true });

export const BASE_URL = process.env['E2E_BASE_URL'] ?? 'http://localhost:3000';
export const API_URL = process.env['E2E_API_URL'] ?? 'http://localhost:3001';
export const DATABASE_URL = process.env['DATABASE_URL'] ?? 'postgres://carnaby@localhost:5432/carnaby';

/** Storage-state files written by global-setup (gitignored). */
export const AUTH_DIR = resolve(REPO_ROOT, 'apps/web-e2e/.auth');
export const ADMIN_STATE = resolve(AUTH_DIR, 'admin.json');
export const USER_STATE = resolve(AUTH_DIR, 'user.json');

/** Every post this suite creates has a slug starting with this; setup/teardown delete them all. */
export const SLUG_PREFIX = 'e2e-test-';

export interface TestUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
}

export const ADMIN_USER: TestUser = { id: 'e2e-admin-user', email: 'e2e-admin@example.test', name: 'E2E Admin', role: 'admin' };
export const REGULAR_USER: TestUser = { id: 'e2e-regular-user', email: 'e2e-user@example.test', name: 'E2E Reader', role: 'user' };
