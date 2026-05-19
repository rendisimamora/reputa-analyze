import * as cheerio from 'cheerio';
import { BaseSource, type SearchResultLink, type SourceMeta } from './baseSource';

export class AntaraSource extends BaseSource {
  meta: SourceMeta = {
    key: 'antara',
    name: 'Antara News',
    baseUrl: 'https://www.antaranews.com',
    credibility: 0.95,
  };

  rssFeeds() {
    return [
      'https://www.antaranews.com/rss/terkini.xml',
      'https://www.antaranews.com/rss/politik.xml',
      'https://www.antaranews.com/rss/ekonomi.xml',
      'https://www.antaranews.com/rss/hukum.xml',
      'https://www.antaranews.com/rss/dunia.xml',
      'https://www.antaranews.com/rss/teknologi.xml',
    ];
  }

  searchUrl(keyword: string) {
    return `https://www.antaranews.com/search?q=${encodeURIComponent(keyword)}`;
  }

  parseSearch(html: string): SearchResultLink[] {
    const $ = cheerio.load(html);
    const out: SearchResultLink[] = [];
    $('.card__post, article').each((_, el) => {
      const a = $(el).find('a').first();
      const url = a.attr('href');
      const title = $(el).find('h2, h3, .card__post__title').first().text().trim();
      const snippet = $(el).find('p').first().text().trim() || undefined;
      if (url && title) out.push({ title, url, snippet });
    });
    return out;
  }

  extractArticle(html: string) {
    return this.genericExtract(html, {
      selectors: ['div.post-content', 'div.wrap__article-detail-content', 'article'],
    });
  }
}
