/** Meta keys that name a page's share image, most specific first. */
const SHARE_IMAGE_KEYS = ['og:image', 'og:image:secure_url', 'og:image:url', 'twitter:image', 'twitter:image:src'] as const;

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

/**
 * Bodies of the `<meta ...>` tags (text between `<meta` and the closing `>`), in one linear pass.
 * `>` inside quotes does not close a tag. An unterminated tag or quote ends the scan, so hostile
 * input cannot make it quadratic.
 */
function* metaTagBodies(html: string): Generator<string> {
  // ASCII-only lowercasing keeps every index valid for `html` (toLowerCase can change length).
  const lower = html.replace(/[A-Z]/g, (c) => c.toLowerCase());
  let from = 0;
  for (;;) {
    const start = lower.indexOf('<meta', from);
    if (start === -1) return;
    const bodyStart = start + 5;
    const next = html[bodyStart];
    if (next !== undefined && !/[\s/>]/.test(next)) {
      from = bodyStart;
      continue;
    }
    let quote: string | null = null;
    let end = -1;
    for (let i = bodyStart; i < html.length; i++) {
      const ch = html[i];
      if (quote) {
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === '>') {
        end = i;
        break;
      }
    }
    if (end === -1) return;
    yield html.slice(bodyStart, end);
    from = end + 1;
  }
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
  for (const body of metaTagBodies(html)) {
    const attributes = parseAttributes(body);
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
