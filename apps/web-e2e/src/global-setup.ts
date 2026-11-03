import { mkdirSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';

import { closeDb, createSessionCookie, deleteAllTestPosts, deleteUsers, SESSION_COOKIE } from './support/db';
import { ADMIN_STATE, ADMIN_USER, API_URL, AUTH_DIR, BASE_URL, REGULAR_USER, USER_STATE } from './support/env';
import { startFakeYoutube } from './support/fake-youtube';

const READY_TIMEOUT_MS = 120_000;

async function waitFor(url: string, label: string): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  for (;;) {
    try {
      const res = await fetch(url, { redirect: 'manual' });
      if (res.status < 500) return;
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) {
      throw new Error(
        `e2e: ${label} at ${url} is not reachable. Start the dev stack first (\`pnpm dev\`, with Postgres running) -- see README "End-to-end tests".`,
      );
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

function writeStorageState(path: string, cookieValue: string): void {
  const { hostname } = new URL(BASE_URL);
  const state = {
    cookies: [
      { name: SESSION_COOKIE, value: cookieValue, domain: hostname, path: '/', expires: -1, httpOnly: true, secure: false, sameSite: 'Lax' },
    ],
    origins: [],
  };
  writeFileSync(path, JSON.stringify(state, null, 2));
}

/**
 * Starts the fake YouTube API when the api is configured to talk to one on localhost. Returns
 * null (and the YouTube spec skips itself) when it isn't, or when the port is already taken by
 * something we don't control.
 */
async function maybeStartFakeYoutube(): Promise<Server | null> {
  const base = process.env['YOUTUBE_API_BASE_URL'];
  if (!base) return null;
  const url = new URL(base);
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.port) return null;
  try {
    const server = await startFakeYoutube(Number(url.port));
    process.env['E2E_FAKE_YOUTUBE'] = '1'; // inherited by the test workers
    return server;
  } catch (error) {
    console.warn(`e2e: fake YouTube API not started on ${url.port} (${(error as Error).message}); YouTube tests will be skipped.`);
    return null;
  }
}

/** Requests every admin route once so Next's dev server compiles them before the timed tests. */
async function warmUp(adminCookie: string): Promise<void> {
  const headers = { cookie: `${SESSION_COOKIE}=${adminCookie}` };
  for (const path of ['/', '/en', '/category/devlog', '/admin', '/admin/posts', '/admin/posts/new', '/admin/youtube', '/login']) {
    await fetch(`${BASE_URL}${path}`, { headers, redirect: 'manual' }).catch(() => undefined);
  }
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  await waitFor(`${API_URL}/api/health`, 'api');
  await waitFor(BASE_URL, 'web');

  const secret = process.env['BETTER_AUTH_SECRET'];
  if (!secret) throw new Error('e2e: BETTER_AUTH_SECRET is not set (repo-root .env).');

  await deleteAllTestPosts();
  mkdirSync(AUTH_DIR, { recursive: true });
  const adminCookie = await createSessionCookie(ADMIN_USER, secret);
  writeStorageState(ADMIN_STATE, adminCookie);
  writeStorageState(USER_STATE, await createSessionCookie(REGULAR_USER, secret));

  const fakeYoutube = await maybeStartFakeYoutube();
  await warmUp(adminCookie);

  return async () => {
    await new Promise<void>((resolve) => (fakeYoutube ? fakeYoutube.close(() => resolve()) : resolve()));
    await deleteAllTestPosts();
    await deleteUsers([ADMIN_USER.id, REGULAR_USER.id]);
    await closeDb();
  };
}
