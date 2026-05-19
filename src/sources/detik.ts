import * as cheerio from 'cheerio';
import { BaseSource, type SearchResultLink, type SourceMeta } from './baseSource';

export class DetikSource extends BaseSource {
  meta: SourceMeta = {
    key: 'detik',
    name: 'Detik',
    baseUrl: 'https://www.detik.com',
    credibility: 0.85,
  };

  rssFeeds() {
    return [
      'https://rss.detik.com/index.php/detikcom',
      'https://rss.detik.com/index.php/news',
      'https://rss.detik.com/index.php/finance',
      'https://rss.detik.com/index.php/inet',
      'https://rss.detik.com/index.php/sport',
      'https://rss.detik.com/index.php/hot',
    ];
  }

  searchUrl(keyword: string) {
    return `https://www.detik.com/search/searchall?query=${encodeURIComponent(keyword)}&sortby=time`;
  }

  parseSearch(html: string): SearchResultLink[] {
    const $ = cheerio.load(html);
    const out: SearchResultLink[] = [];
    $('article').each((_, el) => {
      const a = $(el).find('a').first();
      const url = a.attr('href');
      const title = $(el).find('h2, h3').first().text().trim() || a.attr('title') || '';
      const snippet = $(el).find('.media__desc, .desc').first().text().trim() || undefined;
      const dateStr = $(el).find('.media__date, .date').first().text().trim();
      if (url && title) {
        out.push({ title, url, snippet, publishedAt: dateStr ? new Date(dateStr) : null });
      }
    });
    return out;
  }

  extractArticle(html: string) {
    return this.genericExtract(html, {
      selectors: ['div.detail__body-text', 'div.itp_bodycontent', 'article'],
    });
  }
}
