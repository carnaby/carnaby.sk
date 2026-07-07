// Empty stub aliased in place of the `server-only` marker package for vitest runs
// (see vitest.config.ts `resolve.alias`). In production, Next.js's bundler resolves
// `server-only` to a module that throws when it lands in a client bundle -- that
// build-time guard stays fully intact; this stub only affects the test runner.
export {};
