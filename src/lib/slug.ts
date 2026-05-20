/**
 * Slug utilities for Project URL identifiers.
 *
 *   - per-user unique (handled at DB level via `@@unique([userId, slug])`)
 *   - immutable after create (no API exposed to rename — only generated once)
 *   - URL-safe: lowercase, ASCII, hyphenated, max 80 chars
 *   - reserved words rejected to avoid colliding with sibling routes
 */
import { prisma } from './prisma';

/** Reserved by the app's URL space — must never be allowed as a slug. */
export const RESERVED_SLUGS = new Set([
  'new', 'edit', 'settings', 'mentions', 'alerts', 'report', 'reports',
  'crawl', 'crawl-logs', 'dashboard', 'scan', 'reanalyze', 'summary',
  'api', 'auth', 'login', 'logout', 'register', 'me',
]);

const MAX_LEN = 80;

/** Convert any free-form string to a safe slug fragment. */
export function slugify(input: string): string {
  const ascii = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')    // drop everything that isn't alphanum/space/hyphen
    .trim()
    .replace(/[\s_]+/g, '-')          // whitespace/underscore → hyphen
    .replace(/-+/g, '-')              // collapse repeats
    .replace(/^-+|-+$/g, '');         // trim leading/trailing hyphens
  return ascii.slice(0, MAX_LEN);
}

/**
 * Generate a unique slug for the given user. Auto-appends `-2`, `-3`, … on
 * collision; falls back to a short random suffix after 200 tries (defensive).
 */
export async function generateUniqueProjectSlug(
  userId: string,
  candidateName: string,
): Promise<string> {
  let base = slugify(candidateName);
  if (!base) base = 'project';
  if (RESERVED_SLUGS.has(base)) base = `${base}-1`;

  // Look up siblings that start with the base — single round trip, then resolve locally.
  const taken = await prisma.project.findMany({
    where: { userId, slug: { startsWith: base } },
    select: { slug: true },
  });
  const used = new Set(taken.map((t) => t.slug));

  if (!used.has(base)) return base;
  for (let i = 2; i < 200; i++) {
    const next = `${base}-${i}`;
    if (!used.has(next)) return next;
  }
  // Extremely unlikely fallback
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Validate a user-provided slug (e.g. for future “custom slug” UX).
 * Returns the cleaned slug or throws with a human-readable reason.
 */
export function validateSlug(input: string): string {
  const s = slugify(input);
  if (!s) throw new Error('Slug tidak valid (kosong setelah normalisasi)');
  if (s.length < 2) throw new Error('Slug minimal 2 karakter');
  if (RESERVED_SLUGS.has(s)) throw new Error(`"${s}" adalah kata yang dilarang`);
  return s;
}
