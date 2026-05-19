import * as cheerio from 'cheerio';
import { BaseSource, type SearchResultLink, type SourceMeta } from './baseSource';

export class Liputan6Source extends BaseSource {
  meta: SourceMeta = {
    key: 'liputan6',
    name: 'Liputan6',
    baseUrl: 'https://www.liputan6.com',
    credibility: 0.8,
  };

  rssFeeds() {
    return [
      'https://feed.liputan6.com/rss',
      'https://feed.liputan6.com/rss/news',
      'https://feed.liputan6.com/rss/bisnis',
      'https://feed.liputan6.com/rss/tekno',
      'https://feed.liputan6.com/rss/health',
      'https://feed.liputan6.com/rss/showbiz',
    ];
  }

  searchUrl(keyword: string) {
    return `https://www.liputan6.com/search?q=${encodeURIComponent(keyword)}`;
  }

  parseSearch(html: string): SearchResultLink[] {
    const $ = cheerio.load(html);
    const out: SearchResultLink[] = [];
    $('article, .articles--rows--item').each((_, el) => {
      const a = $(el).find('a').first();
      const url = a.attr('href');
      const title = $(el).find('h2, h3, .articles--rows--item__title').first().text().trim();
      if (url && title) out.push({ title, url });
    });
    return out;
  }

  extractArticle(html: string) {
    return this.genericExtract(html, {
      selectors: ['div.article-content-body__item-content', 'article'],
    });
  }
}
