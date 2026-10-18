import { parseRssOrAtomXml } from './parser';
import type { NewsFeedSource, RawNewsItem } from './types';

export const DEFAULT_NEWS_FEEDS: NewsFeedSource[] = [
  {
    name: 'Google News',
    url: 'https://news.google.com/rss/search?q=Artificial+Intelligence+OR+Tech&hl=en-US&gl=US&ceid=US:en',
  },
  {
    name: 'TechCrunch',
    url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
  },
  {
    name: 'The Verge',
    url: 'https://www.theverge.com/rss/index.xml',
  },
  {
    name: 'Ars Technica',
    url: 'https://feeds.arstechnica.com/arstechnica/technology-lab',
  },
];

export interface FetchRssOptions {
  feeds?: NewsFeedSource[];
  fetchImpl?: typeof fetch;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Fetches and parses a single RSS or Atom feed.
 */
export async function fetchRssFeed(
  url: string,
  sourceName: string,
  fetchFn?: typeof fetch,
  timeoutMs = 8000,
): Promise<RawNewsItem[]> {
  const fetcher = fetchFn ?? fetch;

  try {
    const res = await fetcher(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'User-Agent': 'TierOneAutoBlog/1.0 (News Aggregator; +https://exclusivesources.online)',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9',
      },
    });

    if (!res.ok) {
      console.warn(`[RSS] Failed to fetch feed ${sourceName} (${url}): HTTP ${res.status}`);
      return [];
    }

    const xml = await res.text();
    return parseRssOrAtomXml(xml, sourceName);
  } catch (err) {
    console.warn(`[RSS] Failed fetching feed ${sourceName} (${url}):`, err);
    return [];
  }
}

/**
 * Fetches multiple RSS/Atom feeds in parallel with individual error resilience.
 */
export async function fetchRssFeeds(options?: FetchRssOptions): Promise<RawNewsItem[]> {
  const feeds = options?.feeds ?? DEFAULT_NEWS_FEEDS;
  const fetcher = options?.fetchFn ?? options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? 8000;

  const results = await Promise.allSettled(
    feeds.map((feed) => fetchRssFeed(feed.url, feed.name, fetcher, timeoutMs)),
  );

  const allItems: RawNewsItem[] = [];

  for (const res of results) {
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      allItems.push(...res.value);
    }
  }

  return allItems;
}
