import { BaseSource, type SourceMeta } from './baseSource';

export class SuaraSource extends BaseSource {
  meta: SourceMeta = {
    key: 'suara',
    name: 'Suara.com',
    baseUrl: 'https://www.suara.com',
    credibility: 0.7,
  };

  rssFeeds() {
    return [
      'https://www.suara.com/rss',
      'https://www.suara.com/rss/news',
      'https://www.suara.com/rss/bisnis',
      'https://www.suara.com/rss/tekno',
    ];
  }

  extractArticle(html: string) {
    return this.genericExtract(html, {
      selectors: ['div.detail-content', 'div.content-article', 'article'],
    });
  }
}
