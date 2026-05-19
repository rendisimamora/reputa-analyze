import * as cheerio from 'cheerio';
import { BaseSource, type SearchResultLink, type SourceMeta } from './baseSource';

export class CNNIndonesiaSource extends BaseSource {
  meta: SourceMeta = {
    key: 'cnnindonesia',
    name: 'CNN Indonesia',
    baseUrl: 'https://www.cnnindonesia.com',
    credibility: 0.85,
  };

  rssFeeds() {
    return [
      'https://www.cnnindonesia.com/nasional/rss',
      'https://www.cnnindonesia.com/internasional/rss',
      'https://www.cnnindonesia.com/ekonomi/rss',
      'https://www.cnnindonesia.com/teknologi/rss',
      'https://www.cnnindonesia.com/olahraga/rss',
      'https://www.cnnindonesia.com/hiburan/rss',
    ];
  }

  searchUrl(keyword: string) {
    return `https://www.cnnindonesia.com/search/?query=${encodeURIComponent(keyword)}`;
  }

  parseSearch(html: string): SearchResultLink[] {
    const $ = cheerio.load(html);
    const out: SearchResultLink[] = [];
    $('article, .list .item').each((_, el) => {
      const a = $(el).find('a').first();
      const url = a.attr('href');
      const title = $(el).find('h2, h3, .title').first().text().trim() || a.attr('title') || '';
      if (url && title) out.push({ title, url });
    });
    return out;
  }

  extractArticle(html: string) {
    return this.genericExtract(html, {
      selectors: ['div.detail-text', 'div.detail_text', 'article'],
    });
  }
}
