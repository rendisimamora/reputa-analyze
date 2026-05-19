import { BaseSource, type SourceMeta } from './baseSource';

export class BisnisIndonesiaSource extends BaseSource {
  meta: SourceMeta = {
    key: 'bisnis',
    name: 'Bisnis Indonesia',
    baseUrl: 'https://www.bisnis.com',
    credibility: 0.85,
  };

  rssFeeds() {
    return [
      'https://www.bisnis.com/rss',
      'https://market.bisnis.com/rss',
      'https://ekonomi.bisnis.com/rss',
      'https://kabar24.bisnis.com/rss',
    ];
  }

  extractArticle(html: string) {
    return this.genericExtract(html, {
      selectors: ['div.detailsContent', 'div.detail-content', 'article'],
    });
  }
}
