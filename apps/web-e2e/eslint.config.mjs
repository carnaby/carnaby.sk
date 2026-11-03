import playwright from 'eslint-plugin-playwright';
import baseConfig from '../../eslint.config.mjs';

export default [
  playwright.configs['flat/recommended'],
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.js'],
    rules: {
      // Shared multi-step flows (src/support/lifecycle.ts) assert inside the helper.
      'playwright/expect-expect': ['warn', { assertFunctionNames: ['postLifecycle'] }],
    },
  },
];
