import * as cheerio from 'cheerio';
import { BaseSource, type SearchResultLink, type SourceMeta } from './baseSource';

export class TempoSource extends BaseSource {
  meta: SourceMeta = {
    key: 'tempo',
    name: 'Tempo',
    baseUrl: 'https://www.tempo.co',
    credibility: 0.9,
  };

  rssFeeds() {
    return [
      'https://rss.tempo.co/nasional',
      'https://rss.tempo.co/bisnis',
      'https://rss.tempo.co/internasional',
      'https://rss.tempo.co/metro',
      'https://rss.tempo.co/tekno',
      'https://rss.tempo.co/dunia',
    ];
  }

  searchUrl(keyword: string) {
    return `https://www.tempo.co/search?q=${encodeURIComponent(keyword)}`;
  }

  parseSearch(html: string): SearchResultLink[] {
    const $ = cheerio.load(html);
    const out: SearchResultLink[] = [];
    $('article, .card-box').each((_, el) => {
      const a = $(el).find('a').first();
      const url = a.attr('href');
      const title = $(el).find('h2, h3, .title').first().text().trim();
      const snippet = $(el).find('p, .desc').first().text().trim() || undefined;
      if (url && title) out.push({ title, url, snippet });
    });
    return out;
  }

  extractArticle(html: string) {
    return this.genericExtract(html, {
      selectors: ['div.detail-in', 'div.article__body', 'article'],
    });
  }
}
