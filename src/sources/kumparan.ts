import { BaseSource, type SourceMeta } from './baseSource';

export class KumparanSource extends BaseSource {
  meta: SourceMeta = {
    key: 'kumparan',
    name: 'Kumparan',
    baseUrl: 'https://kumparan.com',
    credibility: 0.75,
  };

  rssFeeds() {
    return ['https://kumparan.com/feed'];
  }

  extractArticle(html: string) {
    return this.genericExtract(html, {
      selectors: ['article', 'div[data-qa-id="story-content"]'],
    });
  }
}
