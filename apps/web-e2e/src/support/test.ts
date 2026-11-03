import { test as base } from '@playwright/test';

import { BASE_URL } from './env';

/**
 * `@playwright/test` with every request to a host other than the app under test aborted
 * (Umami analytics, YouTube thumbnails, ...). Without it a slow or unreachable third party can
 * hold up the page's `load` event and time a test out.
 */
export const test = base.extend<{ blockThirdParty: void }>({
  blockThirdParty: [
    async ({ context }, use) => {
      const appOrigin = new URL(BASE_URL).origin;
      await context.route(
        (url) => url.origin !== appOrigin,
        (route) => route.abort('blockedbyclient'),
      );
      await use();
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
