import { inferAdditionalFields } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

/**
 * better-auth React client. `baseURL: ''` keeps every call same-origin
 * (`/api/auth/*`), which Next's rewrite proxies to the API — so the session
 * cookie the API set is always sent, with no CORS in play.
 *
 * `role` is declared as an additional user field on the server
 * (apps/api/src/auth/auth.ts); the client can't import that server module
 * (it would drag the API runtime into the browser bundle), so the field is
 * re-declared here in `inferAdditionalFields`' literal form to get
 * `useSession().data.user.role` typed. Keep in sync with the API definition.
 */
export const authClient = createAuthClient({
  baseURL: '',
  plugins: [
    inferAdditionalFields({
      user: {
        role: { type: 'string' },
      },
    }),
  ],
});
