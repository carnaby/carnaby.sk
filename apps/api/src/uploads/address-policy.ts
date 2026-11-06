import { isIP } from 'node:net';

/** IPv4 ranges the server never fetches from: "this" network, private, CGNAT, loopback, link-local
 * (incl. cloud metadata 169.254.169.254), IETF/documentation, benchmarking, multicast and reserved. */
const BLOCKED_V4: ReadonlyArray<readonly [string, number]> = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3],
];

function v4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const value = Number(part);
    if (value > 255) return null;
    n = n * 256 + value;
  }
  return n;
}

function isPublicV4(n: number): boolean {
  return !BLOCKED_V4.some(([base, bits]) => {
    const size = 2 ** (32 - bits);
    return Math.floor(n / size) === Math.floor(v4ToInt(base)! / size);
  });
}

/** Eight 16-bit groups; the input was already validated by `net.isIP`. */
function v6Groups(address: string): number[] | null {
  let s = address.toLowerCase();
  const v4Tail = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(s);
  if (v4Tail) {
    const n = v4ToInt(v4Tail[1]!);
    if (n === null) return null;
    s = `${s.slice(0, v4Tail.index)}${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0) return null;
  const groups = [...head, ...Array<string>(fill).fill('0'), ...tail].map((g) => parseInt(g, 16));
  return groups.length === 8 && groups.every((g) => g >= 0 && g <= 0xffff) ? groups : null;
}

/** True only for a globally routable unicast address. Anything else -- including garbage -- is false,
 * so callers can use it as an allowlist check before connecting. */
export function isPublicAddress(ip: string): boolean {
  const address = ip.replace(/^\[|\]$/g, '').split('%')[0]!;
  const family = isIP(address);
  if (family === 4) return isPublicV4(v4ToInt(address)!);
  if (family !== 6) return false;
  const g = v6Groups(address);
  if (!g) return false;
  const embeddedV4 = g[6]! * 65536 + g[7]!;
  const firstFiveZero = g.slice(0, 5).every((x) => x === 0);
  if (firstFiveZero && (g[5] === 0xffff || g[5] === 0)) return isPublicV4(embeddedV4); // ::ffff:a.b.c.d, ::a.b.c.d, ::, ::1
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return isPublicV4(embeddedV4); // NAT64
  if (g[0] === 0x2002) return isPublicV4(g[1]! * 65536 + g[2]!); // 6to4
  if ((g[0]! & 0xfe00) === 0xfc00) return false; // unique local fc00::/7
  if ((g[0]! & 0xffc0) === 0xfe80) return false; // link-local fe80::/10
  if ((g[0]! & 0xff00) === 0xff00) return false; // multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return false; // documentation
  return true;
}
