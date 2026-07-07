import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// @nx/next:application (Nx 23) only supports unitTestRunner "jest" | "none";
// Vitest is wired up by hand here, mirroring apps/api's vitest.config.ts.
export default defineConfig({
  plugins: [nxViteTsPaths(), react()],
  test: {
    globals: true,
    include: ['app/**/*.spec.ts', 'lib/**/*.spec.ts', 'components/**/*.spec.tsx'],
    environment: 'node',
    setupFiles: ['vitest.setup.ts'],
    // Component tests use jsdom environment via // @vitest-environment jsdom pragma.
    passWithNoTests: true,
  },
});
