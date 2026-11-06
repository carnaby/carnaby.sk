/** Meta keys that name a page's share image, most specific first. */
const SHARE_IMAGE_KEYS = ['og:image', 'og:image:secure_url', 'og:image:url', 'twitter:image', 'twitter:image:src'] as const;

const META_TAG = /<meta\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;
const ATTRIBUTE = /([^\s"'=<>`/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function parseAttributes(source: string): Map<string, string> {
  const attributes = new Map<string, string>();
  for (const m of source.matchAll(ATTRIBUTE)) {
    const name = (m[1] ?? '').toLowerCase();
    if (!attributes.has(name)) attributes.set(name, m[2] ?? m[3] ?? m[4] ?? '');
  }
  return attributes;
}

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body.startsWith('#')) {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/** The page's share image (og:image and fallbacks) as an absolute http(s) URL, or null. */
export function findShareImage(html: string, pageUrl: string): string | null {
  const found = new Map<string, string>();
  for (const tag of html.matchAll(META_TAG)) {
    const attributes = parseAttributes(tag[1] ?? '');
    const key = (attributes.get('property') ?? attributes.get('name') ?? '').trim().toLowerCase();
    const content = attributes.get('content')?.trim();
    if (content && (SHARE_IMAGE_KEYS as readonly string[]).includes(key) && !found.has(key)) found.set(key, content);
  }
  for (const key of SHARE_IMAGE_KEYS) {
    const raw = found.get(key);
    if (!raw) continue;
    try {
      const url = new URL(decodeEntities(raw), pageUrl);
      if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString();
    } catch {
      // not a URL -- try the next key
    }
  }
  return null;
}
