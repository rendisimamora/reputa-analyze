import { BaseSource, type SourceMeta } from './baseSource';

export class OkezoneSource extends BaseSource {
  meta: SourceMeta = {
    key: 'okezone',
    name: 'Okezone',
    baseUrl: 'https://www.okezone.com',
    credibility: 0.7,
  };

  rssFeeds() {
    return [
      'https://sindikasi.okezone.com/index.php/rss/0/RSS2.0',
      'https://sindikasi.okezone.com/index.php/rss/1/RSS2.0',
      'https://sindikasi.okezone.com/index.php/rss/6/RSS2.0',
      'https://sindikasi.okezone.com/index.php/rss/11/RSS2.0',
    ];
  }

  extractArticle(html: string) {
    return this.genericExtract(html, {
      selectors: ['div#contentx', 'div.detail-content', 'article'],
    });
  }
}
