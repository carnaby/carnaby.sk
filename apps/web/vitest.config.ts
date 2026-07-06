import { defineConfig } from 'vitest/config';

// @nx/next:application (Nx 23) only supports unitTestRunner "jest" | "none";
// Vitest is wired up by hand here, mirroring apps/api's vitest.config.ts.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['app/**/*.spec.ts'],
  },
});
