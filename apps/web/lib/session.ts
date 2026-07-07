import 'server-only';

import { headers } from 'next/headers';

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:3001';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: string;
}

export interface ServerSession {
  user: SessionUser;
  session: unknown;
}

/**
 * Resolves the current visitor's better-auth session from a Server
 * Component / Server Action by forwarding the incoming request's `cookie`
 * header to the API's `/api/auth/get-session` endpoint.
 *
 * Always `cache: 'no-store'` -- session state must never be served from
 * Next's Data Cache. Returns `null` whenever there is no session, the
 * cookie is invalid/expired, or the API responds with a non-ok status, so
 * callers can treat every falsy result the same way (anonymous).
 */
export async function getServerSession(): Promise<ServerSession | null> {
  const requestHeaders = await headers();
  const cookie = requestHeaders.get('cookie') ?? '';

  const response = await fetch(`${API_INTERNAL_URL}/api/auth/get-session`, {
    headers: { cookie },
    cache: 'no-store',
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json().catch(() => null)) as ServerSession | null;
  return data?.user ? data : null;
}
