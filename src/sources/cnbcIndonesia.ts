import { BaseSource, type SourceMeta } from './baseSource';

export class CNBCIndonesiaSource extends BaseSource {
  meta: SourceMeta = {
    key: 'cnbcindonesia',
    name: 'CNBC Indonesia',
    baseUrl: 'https://www.cnbcindonesia.com',
    credibility: 0.85,
  };

  rssFeeds() {
    return [
      'https://www.cnbcindonesia.com/news/rss',
      'https://www.cnbcindonesia.com/market/rss',
      'https://www.cnbcindonesia.com/investment/rss',
      'https://www.cnbcindonesia.com/tech/rss',
      'https://www.cnbcindonesia.com/entrepreneur/rss',
    ];
  }

  extractArticle(html: string) {
    return this.genericExtract(html, {
      selectors: ['div.detail_text', 'div.detail-text', 'article'],
    });
  }
}
