import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { readFileSync, rmSync, existsSync } from 'node:fs';
import {
  isWithinFreshnessWindow,
  filterFreshNews,
  normalizeUrl,
  extractDomain,
  tokenizeTitle,
  generate3WordShingles,
  calculateJaccardSimilarity,
  isStoryDuplicate,
} from '../lib/pipeline/news/dedup';
import { loadCoveredLedger, recordCoveredStory, saveCoveredLedger } from '../lib/pipeline/news/ledger';
import { scoreNewsItem, rankNewsCandidates } from '../lib/pipeline/news/scorer';
import { aggregateDailyNews } from '../lib/pipeline/news/aggregator';
import type { CoveredEvent, CoveredLedger, RawNewsItem } from '../lib/pipeline/news/types';

test('isWithinFreshnessWindow validates 24-hour cutoff accurately', () => {
  const now = new Date('2026-10-19T12:00:00Z');

  // 2 hours ago -> Fresh
  const twoHoursAgo = new Date('2026-10-19T10:00:00Z').toISOString();
  assert.equal(isWithinFreshnessWindow(twoHoursAgo, now), true);

  // 23 hours ago -> Fresh
  const twentyThreeHoursAgo = new Date('2026-10-18T13:00:00Z').toISOString();
  assert.equal(isWithinFreshnessWindow(twentyThreeHoursAgo, now), true);

  // 25 hours ago -> Stale
  const twentyFiveHoursAgo = new Date('2026-10-18T11:00:00Z').toISOString();
  assert.equal(isWithinFreshnessWindow(twentyFiveHoursAgo, now), false);

  // Invalid date -> False
  assert.equal(isWithinFreshnessWindow('not-a-date', now), false);
});

test('filterFreshNews filters out items exceeding maxAgeHours', () => {
  const now = new Date('2026-10-19T12:00:00Z');
  const items: RawNewsItem[] = [
    {
      id: 'item1',
      title: 'Fresh Story',
      link: 'https://example.com/fresh',
      pubDate: '2026-10-19T10:00:00Z',
      source: 'Test',
      summary: 'Fresh',
    },
    {
      id: 'item2',
      title: 'Old Story',
      link: 'https://example.com/old',
      pubDate: '2026-10-17T12:00:00Z',
      source: 'Test',
      summary: 'Old',
    },
  ];

  const filtered = filterFreshNews(items, 24, now);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 'item1');
});

test('normalizeUrl strips tracking parameters, protocol, www, and trailing slash', () => {
  const dirty =
    'https://www.theverge.com/2026/10/18/claude-update/?utm_source=twitter&utm_medium=social&ref=feed#section2';
  const clean = normalizeUrl(dirty);
  assert.equal(clean, 'theverge.com/2026/10/18/claude-update');

  const dirty2 = 'http://techcrunch.com/article/?fbclid=12345&gclid=67890';
  assert.equal(normalizeUrl(dirty2), 'techcrunch.com/article');
});

test('extractDomain retrieves canonical host', () => {
  assert.equal(extractDomain('https://www.theverge.com/tech/news'), 'theverge.com');
  assert.equal(extractDomain('http://techcrunch.com'), 'techcrunch.com');
});

test('tokenizeTitle and generate3WordShingles create contiguous 3-grams', () => {
  const title = 'Anthropic Releases Claude 3.7 Sonnet with Hybrid Reasoning';
  const tokens = tokenizeTitle(title);

  // Stop words like 'with' should be removed
  assert.ok(!tokens.includes('with'));
  assert.ok(tokens.includes('anthropic'));
  assert.ok(tokens.includes('claude'));
  assert.ok(tokens.includes('sonnet'));

  const shingles = generate3WordShingles(tokens);
  assert.ok(shingles.size >= 2);
  assert.ok(shingles.has('anthropic releases claude'));
});

test('calculateJaccardSimilarity computes accurate set similarity', () => {
  const setA = new Set(['a b c', 'b c d', 'c d e']);
  const setB = new Set(['a b c', 'b c d', 'x y z']);

  // Intersection: 2 ('a b c', 'b c d'), Union: 4 ('a b c', 'b c d', 'c d e', 'x y z') -> 2/4 = 0.5
  const sim = calculateJaccardSimilarity(setA, setB);
  assert.equal(sim, 0.5);

  assert.equal(calculateJaccardSimilarity(new Set(), setB), 0);
  assert.equal(calculateJaccardSimilarity(setA, setA), 1);
});

test('isStoryDuplicate detects duplicates via URL, shingle similarity, and entity overlap', () => {
  const mockCovered: CoveredEvent = {
    id: 'cov-001',
    title: 'Anthropic releases Claude 3.7 Sonnet with hybrid reasoning capabilities',
    normalizedTitle: 'anthropic releases claude sonnet hybrid reasoning capabilities',
    sourceUrl: 'https://www.theverge.com/2026/10/18/anthropic-claude-3-7-sonnet',
    canonicalDomain: 'theverge.com',
    publishedDate: '2026-10-18T18:00:00Z',
    coveredAt: '2026-10-18T19:00:00Z',
    postSlug: 'anthropic-claude-3-7-sonnet-hybrid-reasoning',
    keywords: ['anthropic', 'claude', 'sonnet'],
  };

  const ledger: CoveredLedger = {
    version: 1,
    updatedAt: '2026-10-18T19:00:00Z',
    events: [mockCovered],
  };

  // Case 1: Exact URL match from syndicated feed
  const exactUrlCandidate: RawNewsItem = {
    id: 'cand-1',
    title: 'Different headline for same link',
    link: 'https://www.theverge.com/2026/10/18/anthropic-claude-3-7-sonnet?utm_source=rss',
    pubDate: '2026-10-18T18:00:00Z',
    source: 'Google News',
    summary: 'Summary',
  };
  const urlCheck = isStoryDuplicate(exactUrlCandidate, ledger);
  assert.equal(urlCheck.isDuplicate, true);
  assert.ok(urlCheck.reason?.includes('Exact URL match'));

  // Case 2: Different outlet reporting on same event (TechCrunch headline)
  const competingHeadlineCandidate: RawNewsItem = {
    id: 'cand-2',
    title: 'Anthropic releases Claude 3.7 Sonnet with hybrid reasoning',
    link: 'https://techcrunch.com/2026/10/18/anthropic-claude-3-7-launch/',
    pubDate: '2026-10-18T18:30:00Z',
    source: 'TechCrunch',
    summary: 'Anthropic announced Claude 3.7 Sonnet today.',
  };
  const shingleCheck = isStoryDuplicate(competingHeadlineCandidate, ledger);
  assert.equal(shingleCheck.isDuplicate, true);
  assert.ok(shingleCheck.matchedStory?.id === 'cov-001');

  // Case 3: Completely distinct breaking story
  const distinctCandidate: RawNewsItem = {
    id: 'cand-3',
    title: 'Nvidia announces next-generation Blackwell enterprise server clusters',
    link: 'https://blogs.nvidia.com/blackwell-clusters',
    pubDate: '2026-10-18T20:00:00Z',
    source: 'TechCrunch',
    summary: 'Nvidia announced new compute nodes.',
  };
  const distinctCheck = isStoryDuplicate(distinctCandidate, ledger);
  assert.equal(distinctCheck.isDuplicate, false);
});

test('loadCoveredLedger and recordCoveredStory persist stories to disk', () => {
  const tmpPath = join(process.cwd(), 'tests/fixtures/news/tmp-covered.json');
  if (existsSync(tmpPath)) rmSync(tmpPath);

  try {
    const initialLedger = loadCoveredLedger(tmpPath);
    assert.equal(initialLedger.events.length, 0);

    const newStory: CoveredEvent = {
      id: 'test-event-1',
      title: 'Google releases Gemini 2.5 Flash',
      normalizedTitle: 'google releases gemini flash',
      sourceUrl: 'https://blog.google/gemini-2-5',
      canonicalDomain: 'blog.google',
      publishedDate: '2026-10-18T12:00:00Z',
      coveredAt: '2026-10-18T13:00:00Z',
      postSlug: 'google-gemini-2-5-flash-release',
      keywords: ['google', 'gemini'],
    };

    recordCoveredStory(newStory, tmpPath);

    const reloaded = loadCoveredLedger(tmpPath);
    assert.equal(reloaded.events.length, 1);
    assert.equal(reloaded.events[0].id, 'test-event-1');
  } finally {
    if (existsSync(tmpPath)) rmSync(tmpPath);
  }
});

test('scoreNewsItem weights HN points, entities, cross-mentions, and recency', () => {
  const now = new Date('2026-10-19T12:00:00Z');

  const hnStory: RawNewsItem = {
    id: 'hn-1',
    title: 'OpenAI and Anthropic announce safety collaboration on frontier models',
    link: 'https://example.com/safety',
    pubDate: '2026-10-19T10:00:00Z', // 2 hours old
    source: 'Hacker News',
    summary: 'Summary',
    score: 200,
  };

  const crossMention: RawNewsItem = {
    id: 'tc-1',
    title: 'Anthropic and OpenAI partner on model safety',
    link: 'https://techcrunch.com/safety-partner',
    pubDate: '2026-10-19T11:00:00Z',
    source: 'TechCrunch',
    summary: 'Summary',
  };

  const scored = scoreNewsItem(hnStory, [hnStory, crossMention], now);

  assert.equal(scored.scoreDetails.hnPoints, 300); // 200 * 1.5
  assert.equal(scored.scoreDetails.entityBonus, 80); // matches both 'openai' and 'anthropic'
  assert.equal(scored.scoreDetails.crossFeedMentions, 40); // 1 cross feed sharing 'openai' & 'anthropic' & 'safety'
  assert.ok(scored.scoreDetails.recencyBonus >= 60); // (24 - 2) * 3 = 66
  assert.ok(scored.scoreDetails.totalScore >= 450);
});

test('rankNewsCandidates sorts highest value candidates first', () => {
  const now = new Date('2026-10-19T12:00:00Z');
  const items: RawNewsItem[] = [
    {
      id: 'low-1',
      title: 'Minor bug fix in rust compiler toolchain',
      link: 'https://example.com/rust-fix',
      pubDate: '2026-10-18T14:00:00Z', // 22h old
      source: 'Ars Technica',
      summary: 'Rust fix',
    },
    {
      id: 'high-1',
      title: 'OpenAI Launches ChatGPT Search Engine Globally',
      link: 'https://example.com/chatgpt-search',
      pubDate: '2026-10-19T11:00:00Z', // 1h old
      source: 'TechCrunch',
      summary: 'Search launch',
    },
  ];

  const ledger: CoveredLedger = { version: 1, updatedAt: '', events: [] };
  const ranked = rankNewsCandidates(items, ledger, now);

  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].id, 'high-1');
  assert.ok(ranked[0].scoreDetails.totalScore > ranked[1].scoreDetails.totalScore);
});

test('aggregateDailyNews orchestrates end-to-end multi-feed ingestion with mocks', async () => {
  const now = new Date('2026-10-19T12:00:00Z');
  const fixturesDir = join(process.cwd(), 'tests/fixtures/news');

  const topIds = JSON.parse(readFileSync(join(fixturesDir, 'hn-topstories.json'), 'utf8'));
  const itemsMap = JSON.parse(readFileSync(join(fixturesDir, 'hn-items.json'), 'utf8'));
  const tcXml = readFileSync(join(fixturesDir, 'techcrunch.xml'), 'utf8');

  // Adjust mock items timestamps to be fresh relative to `now`
  for (const key of Object.keys(itemsMap)) {
    itemsMap[key].time = Math.floor(now.getTime() / 1000) - 3600; // 1 hour ago
  }

  const mockFetch = async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (url.endsWith('topstories.json')) {
      return { ok: true, json: async () => topIds } as Response;
    }
    const match = url.match(/\/item\/(\d+)\.json/);
    if (match) {
      const item = itemsMap[match[1]];
      if (item) return { ok: true, json: async () => item } as Response;
    }
    if (url.includes('techcrunch')) {
      return { ok: true, text: async () => tcXml } as Response;
    }
    return { ok: false, status: 404 } as Response;
  };

  const result = await aggregateDailyNews({
    now,
    fetchFn: mockFetch as any,
    sources: [{ name: 'TechCrunch', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' }],
    hnOptions: {
      limit: 10,
      minScore: 80,
    },
  });

  assert.ok(result.totalIngested > 0);
  assert.ok(result.candidates.length > 0);
  assert.ok(result.topStory !== null && result.topStory !== undefined);
  assert.ok(result.topStory.scoreDetails.totalScore > 0);
});
