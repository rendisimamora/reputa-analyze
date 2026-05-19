import * as cheerio from 'cheerio';
import { BaseSource, type SearchResultLink, type SourceMeta } from './baseSource';

export class KompasSource extends BaseSource {
  meta: SourceMeta = {
    key: 'kompas',
    name: 'Kompas',
    baseUrl: 'https://www.kompas.com',
    credibility: 0.9,
  };

  rssFeeds() {
    return [
      'https://www.kompas.com/rss',
      'https://nasional.kompas.com/rss',
      'https://regional.kompas.com/rss',
      'https://money.kompas.com/rss',
      'https://tekno.kompas.com/rss',
      'https://internasional.kompas.com/rss',
    ];
  }

  searchUrl(keyword: string) {
    return `https://search.kompas.com/search?q=${encodeURIComponent(keyword)}`;
  }

  parseSearch(html: string): SearchResultLink[] {
    const $ = cheerio.load(html);
    const out: SearchResultLink[] = [];
    $('.article__list, .gsc-webResult, article').each((_, el) => {
      const a = $(el).find('a').first();
      const url = a.attr('href');
      const title = $(el).find('h1, h2, h3, .gs-title').first().text().trim();
      const snippet = $(el).find('.article__lead, .gs-snippet').first().text().trim() || undefined;
      if (url && title) out.push({ title, url, snippet });
    });
    return out;
  }

  extractArticle(html: string) {
    return this.genericExtract(html, {
      selectors: ['div.read__content', 'div.main-content', 'article'],
    });
  }
}
