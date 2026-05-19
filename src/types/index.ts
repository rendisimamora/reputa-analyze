/**
 * Shared types for ReputaScan ID
 */

export type CollectionMethod = 'RSS' | 'SEARCH_PAGE' | 'ARTICLE_SCRAPE';
export type CrawlStatusType = 'OK' | 'RESTRICTED' | 'RATE_LIMITED' | 'ERROR' | 'PARTIAL';
export type SentimentType = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';

/** Standardized article shape returned by every source adapter. */
export interface CollectedArticle {
  source: string;            // sourceKey
  sourceName: string;        // human-readable
  title: string;
  snippet: string | null;
  url: string;
  publishedAt: Date | null;
  author: string | null;
  rawContent: string | null;
  matchedKeywords: string[];
  collectionMethod: CollectionMethod;
  crawlStatus: CrawlStatusType;
  crawlError?: string;
}

export interface SentimentResult {
  sentiment: SentimentType;
  sentimentScore: number;    // -1..1
  emotion: string;
  toxicity: number;          // 0..1
  hateSpeech: number;        // 0..1
  fakeNews: number;          // 0..1
  topic: string;
  summary: string;
}
