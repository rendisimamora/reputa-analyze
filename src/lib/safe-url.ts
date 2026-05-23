/**
 * URL scheme guard. Use this for any href that comes from user input or
 * crawled content — blocks `javascript:`, `data:`, `vbscript:`, `file:`,
 * etc., which could otherwise be used for XSS via clickjacking.
 *
 *   <a href={safeUrl(m.url)} target="_blank" rel="noreferrer noopener">
 *
 * Returns '#' for any URL that fails the scheme allowlist, so the link
 * becomes a no-op instead of executing arbitrary script.
 */
const ALLOWED_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:'] as const;

export function safeUrl(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') return '#';
  const trimmed = input.trim();
  if (!trimmed) return '#';
  // Reject obvious sneaky payloads before parsing
  // (e.g., "Java\nscript:..." — newlines, tabs that some parsers strip)
  if (/[\x00-\x1f]/.test(trimmed)) return '#';
  try {
    // Use a known base so relative URLs don't get the current page's scheme
    // promoted to https://. We only care about absolute URLs here.
    const url = new URL(trimmed, 'https://reputascan.invalid');
    // If the parsed URL kept our placeholder host, the input was relative —
    // that's fine, but only allow it if it starts with `/` (path-relative).
    if (url.host === 'reputascan.invalid') {
      return trimmed.startsWith('/') ? trimmed : '#';
    }
    if (!ALLOWED_SCHEMES.includes(url.protocol as typeof ALLOWED_SCHEMES[number])) {
      return '#';
    }
    return url.toString();
  } catch {
    return '#';
  }
}
