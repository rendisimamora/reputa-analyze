/**
 * Deduplicate collected articles:
 *  - by canonicalized URL
 *  - by title+snippet content hash
 */
import { canonicalizeUrl, sha256 } from '@/lib/hash';
import type { CollectedArticle } from '@/types';

export interface DedupedArticle extends CollectedArticle {
  urlHash: string;
  contentHash: string;
}

export function dedupe(articles: CollectedArticle[]): DedupedArticle[] {
  const seenUrl = new Set<string>();
  const seenContent = new Set<string>();
  const out: DedupedArticle[] = [];

  for (const a of articles) {
    const canonical = canonicalizeUrl(a.url);
    const urlHash = sha256(canonical);
    if (seenUrl.has(urlHash)) continue;

    const contentHash = sha256(`${a.title}\n${a.snippet ?? ''}`.trim().toLowerCase());
    if (seenContent.has(contentHash)) continue;

    seenUrl.add(urlHash);
    seenContent.add(contentHash);
    out.push({ ...a, url: canonical, urlHash, contentHash });
  }

  return out;
}
