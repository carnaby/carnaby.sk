import { createHmac, randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

import { workspaceRoot } from '@nx/devkit';
import { config as loadEnv } from 'dotenv';
import { eq } from 'drizzle-orm';

import { createDb, session, user } from '@carnaby/db';

// The e2e test process's cwd is the project directory (`apps/web-e2e`), not the workspace root
// (see `playwright.config.mts`'s `webServer.cwd: workspaceRoot` -- it wouldn't need to say so
// explicitly if the ambient cwd already were the root), so a bare `dotenv/config` (which reads
// `<cwd>/.env`) would miss the repo-root `.env` this needs `BETTER_AUTH_SECRET` from.
// `@nx/devkit`'s `workspaceRoot` (already used in `playwright.config.mts` for the same reason)
// gives an absolute path regardless of cwd. Doesn't override already-set env vars (dotenv's
// default), so this is a no-op when the secret is supplied another way (e.g. CI env).
loadEnv({ path: resolve(workspaceRoot, '.env'), quiet: true });

const DATABASE_URL = process.env['DATABASE_URL'] ?? 'postgres://carnaby:carnaby@localhost:5432/carnaby';
const BETTER_AUTH_SECRET = process.env['BETTER_AUTH_SECRET'];

export const E2E_ADMIN_USER_ID = 'e2e-admin-user';
export const E2E_ADMIN_EMAIL = 'e2e-admin@carnaby.sk';

/**
 * The exact cookie name better-auth's `getCookies()` derives for the session-token cookie
 * (`${cookiePrefix}.${cookieName}` with the default prefix `better-auth` and no `__Secure-`
 * prefix in dev/http) -- see `node_modules/better-auth/dist/cookies/index.mjs`.
 */
export const ADMIN_SESSION_COOKIE_NAME = 'better-auth.session_token';

/**
 * Reproduces better-auth's own cookie signature (`makeSignature` in
 * `node_modules/better-auth/dist/crypto/index.mjs`): a raw HMAC-SHA256 digest of the token,
 * base64-encoded (not base64url) -- confirmed by reading that source rather than guessing, since
 * a mismatched signing scheme would fail silently (better-auth's `getSession` just treats an
 * unverifiable cookie as "no session", not an error).
 */
function signSessionToken(token: string, secret: string): string {
  return createHmac('sha256', secret).update(token).digest('base64');
}

export interface AdminSessionCookie {
  name: string;
  value: string;
}

/**
 * Inserts (or reuses) a fixture admin `user` row and always inserts a fresh `session` row
 * directly via drizzle -- bypassing the real Google OAuth round-trip entirely (the dev `.env`
 * ships dummy Google credentials, so that flow can't run headlessly here) -- then returns a
 * Playwright-ready `{ name, value }` cookie descriptor for better-auth's session-token cookie.
 *
 * The returned value is `${token}.${encodeURIComponent(signature)}`: better-auth's cookie parser
 * only URI-decodes a value when it contains a `%` (see `tryDecode` in
 * `dist/cookies/cookie-utils.mjs`), so this round-trips correctly whether or not the signature
 * happens to need encoding -- matching exactly what a real sign-in would set.
 */
export async function createAdminSessionCookie(): Promise<AdminSessionCookie> {
  if (!BETTER_AUTH_SECRET) {
    throw new Error(
      'createAdminSessionCookie: BETTER_AUTH_SECRET is not set -- check the repo-root .env (see .env.example).',
    );
  }

  const { db, pool } = createDb(DATABASE_URL);
  try {
    const [existing] = await db.select().from(user).where(eq(user.id, E2E_ADMIN_USER_ID)).limit(1);
    if (!existing) {
      await db.insert(user).values({
        id: E2E_ADMIN_USER_ID,
        name: 'E2E Admin',
        email: E2E_ADMIN_EMAIL,
        emailVerified: true,
        role: 'admin',
      });
    }

    const token = randomBytes(32).toString('hex');
    await db.insert(session).values({
      id: `e2e-session-${randomBytes(16).toString('hex')}`,
      token,
      userId: E2E_ADMIN_USER_ID,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const signature = signSessionToken(token, BETTER_AUTH_SECRET);
    return {
      name: ADMIN_SESSION_COOKIE_NAME,
      value: `${token}.${encodeURIComponent(signature)}`,
    };
  } finally {
    await pool.end();
  }
}
