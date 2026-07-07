import { defineConfig } from 'vitest/config';

// @nx/next:application (Nx 23) only supports unitTestRunner "jest" | "none";
// Vitest is wired up by hand here, mirroring apps/api's vitest.config.ts.
export default defineConfig({
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
