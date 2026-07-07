import createIntlMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';

import { routing } from './i18n/routing';
import { legacyLanguageRedirect } from './lib/legacy-lang';

const intlMiddleware = createIntlMiddleware(routing);

export default function middleware(request: NextRequest) {
  // v1's `?language=` links must keep working; check that first and only
  // fall through to next-intl's own locale routing when there's nothing to
  // redirect.
  const legacyRedirect = legacyLanguageRedirect(request.nextUrl);
  if (legacyRedirect) {
    return NextResponse.redirect(legacyRedirect, 307);
  }

  return intlMiddleware(request);
}

export const config = {
  // Skip API/tRPC proxying, static assets, the Next internals, the
  // (future, Slovak-only) admin area, and any request for a file with an
  // extension (favicon.ico, robots.txt, etc.).
  matcher: ['/((?!api|trpc|images|_next|admin|.*\\..*).*)'],
};
