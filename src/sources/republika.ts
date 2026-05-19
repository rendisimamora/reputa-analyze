import { BaseSource, type SourceMeta } from './baseSource';

export class RepublikaSource extends BaseSource {
  meta: SourceMeta = {
    key: 'republika',
    name: 'Republika',
    baseUrl: 'https://www.republika.co.id',
    credibility: 0.8,
  };

  rssFeeds() {
    return [
      'https://www.republika.co.id/rss',
      'https://news.republika.co.id/rss',
      'https://ekonomi.republika.co.id/rss',
      'https://internasional.republika.co.id/rss',
    ];
  }

  extractArticle(html: string) {
    return this.genericExtract(html, {
      selectors: ['div.article-content', 'article'],
    });
  }
}
