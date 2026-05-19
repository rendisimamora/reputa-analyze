import { BaseSource, type SourceMeta } from './baseSource';

export class VivaSource extends BaseSource {
  meta: SourceMeta = {
    key: 'viva',
    name: 'Viva',
    baseUrl: 'https://www.viva.co.id',
    credibility: 0.7,
  };

  rssFeeds() {
    return [
      'https://www.viva.co.id/rss',
      'https://www.viva.co.id/rss/news',
      'https://www.viva.co.id/rss/bisnis',
      'https://www.viva.co.id/rss/teknologi',
    ];
  }

  extractArticle(html: string) {
    return this.genericExtract(html, {
      selectors: ['div.main-content-detail', 'article'],
    });
  }
}
