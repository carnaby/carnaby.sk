import { defineRouting } from 'next-intl/routing';

import { DEFAULT_LANGUAGE, LANGUAGES } from '@carnaby/shared';

// sk is the default and stays unprefixed (`/`, `/posts/x`); en is prefixed
// (`/en`, `/en/posts/x`). This mirrors v1's default-Slovak site with an
// English toggle, without a permanent `/sk/...` prefix nobody ever linked to.
export const routing = defineRouting({
  locales: LANGUAGES,
  defaultLocale: DEFAULT_LANGUAGE,
  localePrefix: 'as-needed',
  // next-intl defaults to negotiating the unprefixed locale from the request's `Accept-Language`
  // header, which would silently override the "sk unprefixed default" behaviour described above
  // for any visitor (or, notably, any Playwright browser -- its default locale is `en-US`) whose
  // browser prefers English. Disabled so `/` and `/posts/x` are always sk unless the visitor
  // explicitly switches (`LanguageSwitcher`, which encodes the choice in the URL itself --
  // `/en/...` -- rather than relying on this negotiation).
  localeDetection: false,
});
