import { BaseSource, type SourceMeta } from './baseSource';

export class MerdekaSource extends BaseSource {
  meta: SourceMeta = {
    key: 'merdeka',
    name: 'Merdeka',
    baseUrl: 'https://www.merdeka.com',
    credibility: 0.75,
  };

  rssFeeds() {
    return [
      'https://www.merdeka.com/feed/',
      'https://www.merdeka.com/feed/peristiwa.rss',
      'https://www.merdeka.com/feed/politik.rss',
      'https://www.merdeka.com/feed/uang.rss',
      'https://www.merdeka.com/feed/teknologi.rss',
    ];
  }

  extractArticle(html: string) {
    return this.genericExtract(html, {
      selectors: ['div.mdk-content', 'article'],
    });
  }
}
