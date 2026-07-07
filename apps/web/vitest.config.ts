import { defineConfig } from 'vitest/config';

// @nx/next:application (Nx 23) only supports unitTestRunner "jest" | "none";
// Vitest is wired up by hand here, mirroring apps/api's vitest.config.ts.
export default defineConfig({
  // The `server-only` marker package (imported by lib/trpc-server.ts and
  // lib/session.ts) resolves to a module that throws unless the "react-server"
  // export condition is active -- that's how Next.js's bundler enforces the
  // server/client boundary at build time. Vitest runs everything through a
  // plain Node/SSR resolution, so without this it would throw on import even
  // though these specs never leave the server. Scoped to `ssr.resolve` only,
  // so it doesn't affect how client-bundled code would resolve.
  ssr: { resolve: { conditions: ['react-server'] } },
  test: {
    globals: true,
    environment: 'node',
    include: ['app/**/*.spec.ts', 'lib/**/*.spec.ts'],
    // No app-route spec files exist yet (Task 12 removed the generator's demo
    // /api/hello route); design-system components are verified visually per
    // the task brief rather than via unit tests.
    passWithNoTests: true,
  },
});
