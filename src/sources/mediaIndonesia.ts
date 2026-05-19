import { BaseSource, type SourceMeta } from './baseSource';

export class MediaIndonesiaSource extends BaseSource {
  meta: SourceMeta = {
    key: 'mediaindonesia',
    name: 'Media Indonesia',
    baseUrl: 'https://mediaindonesia.com',
    credibility: 0.8,
  };

  rssFeeds() {
    return ['https://mediaindonesia.com/feed'];
  }

  extractArticle(html: string) {
    return this.genericExtract(html, {
      selectors: ['div.detail-content', 'article'],
    });
  }
}
