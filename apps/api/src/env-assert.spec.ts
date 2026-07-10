import { describe, expect, it } from 'vitest';
import { assertProductionEnv } from './env-assert';

describe('assertProductionEnv', () => {
  it('is a no-op outside production, even with everything missing', () => {
    expect(() => assertProductionEnv({})).not.toThrow();
    expect(() => assertProductionEnv({ NODE_ENV: 'development' })).not.toThrow();
    expect(() => assertProductionEnv({ NODE_ENV: 'test' })).not.toThrow();
  });

  it('throws in production when BETTER_AUTH_SECRET is missing', () => {
    expect(() =>
      assertProductionEnv({ NODE_ENV: 'production', DATABASE_URL: 'postgres://x' }),
    ).toThrow(/BETTER_AUTH_SECRET/);
  });

  it('throws in production when DATABASE_URL is missing', () => {
    expect(() =>
      assertProductionEnv({ NODE_ENV: 'production', BETTER_AUTH_SECRET: 'shh' }),
    ).toThrow(/DATABASE_URL/);
  });

  it('names every missing var when both are unset', () => {
    expect(() => assertProductionEnv({ NODE_ENV: 'production' })).toThrow(
      /BETTER_AUTH_SECRET, DATABASE_URL/,
    );
  });

  it('does not throw in production when both are set', () => {
    expect(() =>
      assertProductionEnv({
        NODE_ENV: 'production',
        BETTER_AUTH_SECRET: 'shh',
        DATABASE_URL: 'postgres://x',
      }),
    ).not.toThrow();
  });
});
