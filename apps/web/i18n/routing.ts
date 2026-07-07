import { defineRouting } from 'next-intl/routing';

import { DEFAULT_LANGUAGE, LANGUAGES } from '@carnaby/shared';

// sk is the default and stays unprefixed (`/`, `/posts/x`); en is prefixed
// (`/en`, `/en/posts/x`). This mirrors v1's default-Slovak site with an
// English toggle, without a permanent `/sk/...` prefix nobody ever linked to.
export const routing = defineRouting({
  locales: LANGUAGES,
  defaultLocale: DEFAULT_LANGUAGE,
  localePrefix: 'as-needed',
});
