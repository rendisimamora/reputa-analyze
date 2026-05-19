import * as cheerio from 'cheerio';
import { BaseSource, type SearchResultLink, type SourceMeta } from './baseSource';

export class TribunnewsSource extends BaseSource {
  meta: SourceMeta = {
    key: 'tribunnews',
    name: 'Tribunnews',
    baseUrl: 'https://www.tribunnews.com',
    credibility: 0.7,
  };

  rssFeeds() {
    return [
      'https://www.tribunnews.com/rss',
      'https://www.tribunnews.com/nasional/rss',
      'https://www.tribunnews.com/bisnis/rss',
      'https://www.tribunnews.com/internasional/rss',
      'https://www.tribunnews.com/techno/rss',
    ];
  }

  searchUrl(keyword: string) {
    return `https://www.tribunnews.com/search?q=${encodeURIComponent(keyword)}`;
  }

  parseSearch(html: string): SearchResultLink[] {
    const $ = cheerio.load(html);
    const out: SearchResultLink[] = [];
    $('li.ptb15, article').each((_, el) => {
      const a = $(el).find('a').first();
      const url = a.attr('href');
      const title = $(el).find('h3, h2').first().text().trim();
      if (url && title) out.push({ title, url });
    });
    return out;
  }

  extractArticle(html: string) {
    return this.genericExtract(html, {
      selectors: ['div.side-article.txt-article', 'div.detail-content', 'article'],
    });
  }
}
