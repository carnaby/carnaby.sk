import Script from 'next/script';

const WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
const SRC = process.env.NEXT_PUBLIC_UMAMI_SRC;

/**
 * Umami analytics snippet. Renders nothing when either env var is unset (local dev/CI don't set
 * them -- see root `.env.example`), so the site works identically without an analytics instance
 * configured. Mounted from `app/[locale]/layout.tsx`, which only wraps the public `(public)`
 * route group; the admin area (Task 18) has no `[locale]` segment, so it never renders this.
 */
export function Umami() {
  if (!WEBSITE_ID || !SRC) return null;
  return <Script src={SRC} data-website-id={WEBSITE_ID} strategy="afterInteractive" />;
}
