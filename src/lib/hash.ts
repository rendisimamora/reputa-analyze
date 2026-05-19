import { createHash } from 'crypto';

/** SHA-256 hex digest. */
export function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

/** Canonicalize a URL for deduplication: lowercase host, strip utm_*, fragment, trailing slash. */
export function canonicalizeUrl(input: string): string {
  try {
    const u = new URL(input);
    u.hash = '';
    u.host = u.host.toLowerCase();
    const params = new URLSearchParams();
    for (const [k, v] of u.searchParams) {
      if (k.toLowerCase().startsWith('utm_')) continue;
      if (['fbclid', 'gclid', 'mc_eid', 'mc_cid', 'ref', 'source'].includes(k.toLowerCase())) continue;
      params.append(k, v);
    }
    u.search = params.toString();
    let p = u.pathname;
    if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
    u.pathname = p;
    return u.toString();
  } catch {
    return input;
  }
}
