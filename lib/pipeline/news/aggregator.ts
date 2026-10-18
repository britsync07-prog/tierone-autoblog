import { fetchHackerNewsStories, type FetchHackerNewsOptions } from './hn';
import { loadCoveredLedger } from './ledger';
import { fetchRssFeeds } from './rss';
import { rankNewsCandidates } from './scorer';
import { isStoryDuplicate, isWithinFreshnessWindow } from './dedup';
import type { NewsFeedSource, RawNewsItem, ScoredNewsCandidate } from './types';

export interface AggregateDailyNewsOptions {
  force?: boolean;
  ledgerPath?: string;
  now?: Date;
  fetchImpl?: typeof fetch;
  fetchFn?: typeof fetch;
  sources?: NewsFeedSource[];
  feeds?: NewsFeedSource[];
  hnOptions?: FetchHackerNewsOptions;
}

export interface AggregateDailyNewsResult {
  selected?: ScoredNewsCandidate | null;
  topStory?: ScoredNewsCandidate | null;
  candidates: ScoredNewsCandidate[];
  totalIngested: number;
  rejectedCount: number;
  duplicatesFiltered: number;
}

/**
 * Coordinates multi-feed ingestion, freshness gating, deduplication against covered.json,
 * and ranking to select top candidate stories.
 */
export async function aggregateDailyNews(
  options?: AggregateDailyNewsOptions,
): Promise<AggregateDailyNewsResult> {
  const fetcher = options?.fetchFn ?? options?.fetchImpl ?? fetch;
  const now = options?.now ?? new Date();
  const feeds = options?.sources ?? options?.feeds;

  // 1. Fetch HN and RSS feeds concurrently
  const [hnItems, rssItems] = await Promise.all([
    fetchHackerNewsStories({
      fetchFn: fetcher,
      now,
      ...options?.hnOptions,
    }),
    fetchRssFeeds({
      feeds,
      fetchFn: fetcher,
    }),
  ]);

  const rawItems: RawNewsItem[] = [...hnItems, ...rssItems];
  const totalIngested = rawItems.length;

  // 2. Load persistent covered history
  const ledger = loadCoveredLedger(options?.ledgerPath);

  // 3. Track metrics
  let duplicatesFiltered = 0;
  for (const item of rawItems) {
    if (isWithinFreshnessWindow(item.pubDate, now)) {
      const dup = isStoryDuplicate(item, ledger, { now });
      if (dup.isDuplicate) {
        duplicatesFiltered += 1;
      }
    }
  }

  // 4. Rank and score remaining candidates
  const candidates = rankNewsCandidates(rawItems, ledger, now);
  const selected = candidates[0] ?? null;
  const rejectedCount = Math.max(0, totalIngested - candidates.length);

  return {
    selected,
    topStory: selected,
    candidates,
    totalIngested,
    rejectedCount,
    duplicatesFiltered,
  };
}
