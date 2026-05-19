/**
 * Lightweight keyword matcher. Case-insensitive, word-boundary aware,
 * works for Indonesian (no morphology, just normalization).
 */
function normalize(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param haystack Combined text (title + snippet + content)
 * @param keywords List of search terms
 * @param mode ANY: at least one matches; ALL: every term must match
 * @returns matched terms (preserves original casing from keywords[])
 */
export function matchKeywords(
  haystack: string,
  keywords: string[],
  mode: 'ANY' | 'ALL' = 'ANY',
): { matched: string[]; isMatch: boolean } {
  if (!keywords.length) return { matched: [], isMatch: false };
  const hay = ' ' + normalize(haystack) + ' ';
  const matched: string[] = [];
  for (const kw of keywords) {
    const n = normalize(kw).trim();
    if (!n) continue;
    // word-ish boundary that also tolerates hyphens / dots
    const re = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRegex(n)}(?:$|[^\\p{L}\\p{N}])`, 'u');
    if (re.test(hay)) matched.push(kw);
  }
  const isMatch = mode === 'ALL' ? matched.length === keywords.length : matched.length > 0;
  return { matched, isMatch };
}
