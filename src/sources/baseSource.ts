/**
 * Source adapter base class.
 *
 * Every concrete adapter implements:
 *  - `rssFeeds()`   : list of RSS endpoints to poll
 *  - `searchUrl?()` : optional public search URL builder
 *  - `parseSearch?()`: optional cheerio-based search results parser
 *  - `extractArticle?()`: optional full-article scraper
 *
 * Adapters MUST NOT call any third-party authenticated API.
 * All requests go through `politeFetch` which handles robots.txt + rate limit + logging.
 */
import Parser from 'rss-parser';
import * as cheerio from 'cheerio';
import { politeFetch } from '@/lib/httpFetch';
import { matchKeywords } from '@/lib/keywordMatcher';
import { env } from '@/lib/env';
import type { CollectedArticle, CollectionMethod } from '@/types';

export interface SourceMeta {
  /** stable identifier used in DB (e.g. "detik") */
  key: string;
  /** human-readable name */
  name: string;
  /** root URL — used to scope robots.txt / link normalization */
  baseUrl: string;
  /** credibility weight 0..1 (used by reputation scoring) */
  credibility: number;
}

export interface SearchResultLink {
  title: string;
  url: string;
  snippet?: string;
  publishedAt?: Date | null;
  author?: string | null;
}

const rss = new Parser({
  customFields: {
    item: [
      ['content:encoded', 'contentEncoded'],
      ['dc:creator', 'dcCreator'],
      ['media:content', 'mediaContent'],
    ],
  },
  timeout: 15_000,
});

export abstract class BaseSource {
  abstract meta: SourceMeta;
  /** RSS feed URLs to poll. */
  abstract rssFeeds(): string[];
  /** Optional: build a search URL for the given keyword. */
  searchUrl?(keyword: string): string | null;
  /** Optional: parse search results HTML using cheerio. */
  parseSearch?(html: string, baseUrl: string): SearchResultLink[];
  /** Optional: extract clean article body from a public article URL. */
  extractArticle?(html: string): { content: string; author?: string | null; publishedAt?: Date | null };

  /**
   * Collect mentions for one set of keywords. Strategy:
   *  1. Try RSS first (always polite, structured).
   *  2. Filter by keyword.
   *  3. If a searchUrl is defined and zero RSS hits, fall back to scraping the public search page.
   *  4. Optionally fetch each article URL for full content (if extractArticle defined).
   */
  async collect(opts: {
    keywords: string[];
    matchMode: 'ANY' | 'ALL';
    projectId?: string;
    fetchFullContent?: boolean;
  }): Promise<CollectedArticle[]> {
    const out: CollectedArticle[] = [];
    const seen = new Set<string>();

    // ---- 1. RSS ----
    for (const feedUrl of this.rssFeeds()) {
      const res = await politeFetch(feedUrl, {
        method: 'RSS',
        sourceKey: this.meta.key,
        projectId: opts.projectId,
        accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
      });
      if (!res.ok) continue;
      let parsed;
      try {
        parsed = await rss.parseString(res.body);
      } catch {
        continue;
      }
      for (const item of parsed.items ?? []) {
        if (out.length >= env.maxArticlesPerSource) break;
        const title = (item.title ?? '').trim();
        const url = (item.link ?? '').trim();
        if (!title || !url || seen.has(url)) continue;
        const snippet =
          (item.contentSnippet ?? item.summary ?? this.stripHtml((item as { contentEncoded?: string }).contentEncoded ?? ''))?.trim() ??
          null;
        const hay = `${title}\n${snippet ?? ''}`;
        const m = matchKeywords(hay, opts.keywords, opts.matchMode);
        if (!m.isMatch) continue;
        seen.add(url);
        out.push({
          source: this.meta.key,
          sourceName: this.meta.name,
          title,
          snippet: snippet ?? null,
          url,
          publishedAt: item.isoDate ? new Date(item.isoDate) : item.pubDate ? new Date(item.pubDate) : null,
          author: item.creator ?? (item as { dcCreator?: string }).dcCreator ?? null,
          rawContent: this.stripHtml((item as { contentEncoded?: string }).contentEncoded ?? '') || null,
          matchedKeywords: m.matched,
          collectionMethod: 'RSS' as CollectionMethod,
          crawlStatus: 'OK',
        });
      }
      if (out.length >= env.maxArticlesPerSource) break;
    }

    // ---- 2. Search page fallback ----
    if (out.length === 0 && this.searchUrl && this.parseSearch) {
      for (const kw of opts.keywords) {
        if (out.length >= env.maxArticlesPerSource) break;
        const u = this.searchUrl(kw);
        if (!u) continue;
        const res = await politeFetch(u, {
          method: 'SEARCH_PAGE',
          sourceKey: this.meta.key,
          projectId: opts.projectId,
        });
        if (!res.ok) continue;
        let links: SearchResultLink[] = [];
        try {
          links = this.parseSearch(res.body, this.meta.baseUrl);
        } catch {
          links = [];
        }
        for (const link of links) {
          if (out.length >= env.maxArticlesPerSource) break;
          if (!link.url || seen.has(link.url)) continue;
          const m = matchKeywords(`${link.title}\n${link.snippet ?? ''}`, opts.keywords, opts.matchMode);
          if (!m.isMatch) continue;
          seen.add(link.url);
          out.push({
            source: this.meta.key,
            sourceName: this.meta.name,
            title: link.title,
            snippet: link.snippet ?? null,
            url: link.url,
            publishedAt: link.publishedAt ?? null,
            author: link.author ?? null,
            rawContent: null,
            matchedKeywords: m.matched,
            collectionMethod: 'SEARCH_PAGE' as CollectionMethod,
            crawlStatus: 'OK',
          });
        }
      }
    }

    // ---- 3. Optional full-article extraction ----
    if (opts.fetchFullContent && this.extractArticle) {
      for (const art of out) {
        if (art.rawContent && art.rawContent.length > 400) continue; // already enough
        const res = await politeFetch(art.url, {
          method: 'ARTICLE_SCRAPE',
          sourceKey: this.meta.key,
          projectId: opts.projectId,
        });
        if (!res.ok) {
          if (res.reason === 'RESTRICTED') {
            art.crawlStatus = 'RESTRICTED';
            art.crawlError = res.error;
          } else {
            art.crawlStatus = 'PARTIAL';
            art.crawlError = res.error;
          }
          continue;
        }
        try {
          const parsed = this.extractArticle(res.body);
          if (parsed.content) art.rawContent = parsed.content;
          if (parsed.author && !art.author) art.author = parsed.author;
          if (parsed.publishedAt && !art.publishedAt) art.publishedAt = parsed.publishedAt;
        } catch (err) {
          art.crawlStatus = 'PARTIAL';
          art.crawlError = err instanceof Error ? err.message : String(err);
        }
      }
    }

    return out;
  }

  /** Generic cheerio-based article extractor — used by most adapters. */
  protected genericExtract(html: string, opts?: { selectors?: string[] }): {
    content: string;
    author?: string | null;
    publishedAt?: Date | null;
  } {
    const $ = cheerio.load(html);
    const sels = opts?.selectors ?? [
      'article',
      'div.detail__body-text',
      'div.read__content',
      'div.itp_bodycontent',
      'div.article-content',
      'div.entry-content',
      'div.content-text',
      'div.main-content',
      'div.post-content',
      'div.detail-content',
    ];
    let body = '';
    for (const s of sels) {
      const el = $(s).first();
      if (el.length) {
        body = el
          .find('p, h2, h3, li')
          .map((_, p) => $(p).text().trim())
          .get()
          .filter(Boolean)
          .join('\n\n');
        if (body.length > 200) break;
      }
    }
    if (!body) {
      body = $('p').map((_, p) => $(p).text().trim()).get().filter(Boolean).join('\n\n');
    }
    body = body.replace(/\s+\n/g, '\n').slice(0, 20_000);

    const author =
      $('meta[name="author"]').attr('content') ||
      $('meta[property="article:author"]').attr('content') ||
      $('.author, .penulis, [itemprop="author"]').first().text().trim() ||
      null;

    const publishedRaw =
      $('meta[property="article:published_time"]').attr('content') ||
      $('meta[name="pubdate"]').attr('content') ||
      $('time[datetime]').attr('datetime') ||
      null;
    const publishedAt = publishedRaw ? this.safeDate(publishedRaw) : null;

    return { content: body, author, publishedAt };
  }

  protected stripHtml(s: string): string {
    if (!s) return '';
    return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  protected safeDate(s: string): Date | null {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
}
