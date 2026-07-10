/**
 * Fails fast at boot when running in production without the secrets the app cannot function
 * without. Both `BETTER_AUTH_SECRET` (session/cookie signing -- an unset value would make
 * better-auth fall back to an insecure default) and `DATABASE_URL` (the api connects with
 * `createDb(process.env.DATABASE_URL!)` -- a `!` that silently becomes `createDb(undefined)` and
 * fails with a confusing `pg` connection error otherwise) are required in production.
 *
 * A no-op outside production (`NODE_ENV !== 'production'`) so local dev without a full `.env`
 * (or `vitest` runs) is unaffected.
 */
export function assertProductionEnv(env: Partial<Record<'NODE_ENV' | 'BETTER_AUTH_SECRET' | 'DATABASE_URL', string>>): void {
  if (env.NODE_ENV !== 'production') return;

  const missing = (['BETTER_AUTH_SECRET', 'DATABASE_URL'] as const).filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Refusing to boot in production: missing required env var(s): ${missing.join(', ')}. ` +
        'Set them in the environment (see docker/docker-compose.local-prod.yml for the expected shape).',
    );
  }
}
