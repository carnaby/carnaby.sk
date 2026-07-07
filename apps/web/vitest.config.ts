import path from 'node:path';

import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// @nx/next:application (Nx 23) only supports unitTestRunner "jest" | "none";
// Vitest is wired up by hand here, mirroring apps/api's vitest.config.ts.
export default defineConfig({
  plugins: [nxViteTsPaths(), react()],
  resolve: {
    alias: {
      // The `server-only` marker package (imported by lib/trpc-server.ts and
      // lib/session.ts) resolves to a module that throws unless bundled with
      // the "react-server" export condition -- that's how Next.js enforces the
      // server/client boundary at build time. That build-time guard must stay
      // in the source; for the test runner we alias the package to an empty
      // stub instead of activating the react-server condition, because that
      // condition breaks react-dom/client for the jsdom component specs.
      'server-only': path.resolve(__dirname, 'specs/stubs/empty.ts'),
    },
  },
  test: {
    globals: true,
    include: ['app/**/*.spec.ts', 'lib/**/*.spec.ts', 'components/**/*.spec.tsx', 'specs/**/*.spec.ts'],
    environment: 'node',
    setupFiles: ['vitest.setup.ts'],
    // Component tests use jsdom environment via // @vitest-environment jsdom pragma.
    passWithNoTests: true,
  },
});
