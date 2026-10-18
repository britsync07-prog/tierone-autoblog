import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanCdataAndEntities, parseRssOrAtomXml } from '../lib/pipeline/news/parser';
import { fetchHackerNewsStories } from '../lib/pipeline/news/hn';
import { fetchRssFeed } from '../lib/pipeline/news/rss';

const FIXTURES_DIR = join(process.cwd(), 'tests/fixtures/news');

test('cleanCdataAndEntities handles CDATA, entities, and HTML tags', () => {
  const dirty =
    '<![CDATA[OpenAI &amp; Microsoft Announce <a href="https://example.com">Expanded</a> &#8217;New&#8217; Tier &quot;Fast&quot;]]>';
  const cleaned = cleanCdataAndEntities(dirty);
  assert.equal(cleaned, "OpenAI & Microsoft Announce Expanded 'New' Tier \"Fast\"");
});

test('cleanCdataAndEntities handles malformed or empty inputs gracefully', () => {
  assert.equal(cleanCdataAndEntities(''), '');
  assert.equal(cleanCdataAndEntities('   '), '');
  assert.equal(cleanCdataAndEntities('No tags here'), 'No tags here');
});

test('parseRssOrAtomXml parses RSS 2.0 feeds correctly (Google News & TechCrunch)', () => {
  const googleXml = readFileSync(join(FIXTURES_DIR, 'google-news.xml'), 'utf8');
  const googleItems = parseRssOrAtomXml(googleXml, 'Google News');

  assert.equal(googleItems.length, 2);
  assert.equal(googleItems[0].source, 'Google News');
  assert.equal(googleItems[0].title, 'OpenAI & Microsoft Announce Expanded Developer API Tier');
  assert.ok(googleItems[0].link.startsWith('https://news.google.com'));
  assert.ok(googleItems[0].id.length === 16);
  assert.ok(!Number.isNaN(Date.parse(googleItems[0].pubDate)));
  assert.ok(!googleItems[0].summary.includes('<a href')); // HTML stripped

  const tcXml = readFileSync(join(FIXTURES_DIR, 'techcrunch.xml'), 'utf8');
  const tcItems = parseRssOrAtomXml(tcXml, 'TechCrunch');

  assert.equal(tcItems.length, 2);
  assert.equal(tcItems[0].title, 'Meta AI introduces Llama 4 code models for open source developers');
  assert.equal(tcItems[0].author, 'Sarah Perez');
  assert.ok(tcItems[0].link.includes('meta-llama-4-code-models'));
  assert.equal(tcItems[1].author, 'Kyle Wiggers');
});

test('parseRssOrAtomXml parses Atom 1.0 feeds correctly (The Verge)', () => {
  const vergeXml = readFileSync(join(FIXTURES_DIR, 'theverge.xml'), 'utf8');
  const vergeItems = parseRssOrAtomXml(vergeXml, 'The Verge');

  assert.equal(vergeItems.length, 2);
  assert.equal(vergeItems[0].source, 'The Verge');
  assert.equal(
    vergeItems[0].title,
    'DeepSeek releases reasoning model with open architectural weights',
  );
  assert.equal(
    vergeItems[0].link,
    'https://www.theverge.com/2026/10/18/deepseek-reasoning-open-weights',
  );
  assert.equal(vergeItems[0].author, 'Alex Heath');
  assert.ok(vergeItems[0].id.length === 16);
  assert.equal(vergeItems[1].title, 'Cursor AI launches team workspace features & enterprise security controls');
  assert.equal(vergeItems[1].author, 'David Pierce');
});

test('parseRssOrAtomXml returns empty array for invalid or non-xml input', () => {
  assert.deepEqual(parseRssOrAtomXml('', 'Empty'), []);
  assert.deepEqual(parseRssOrAtomXml('random non-xml text', 'Invalid'), []);
});

test('fetchHackerNewsStories filters for score, AI keywords, and 24h freshness', async () => {
  const topIds: number[] = JSON.parse(
    readFileSync(join(FIXTURES_DIR, 'hn-topstories.json'), 'utf8'),
  );
  const itemsMap: Record<string, any> = JSON.parse(
    readFileSync(join(FIXTURES_DIR, 'hn-items.json'), 'utf8'),
  );

  // Mock fetch implementation
  const mockFetch = async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (url.endsWith('topstories.json')) {
      return {
        ok: true,
        json: async () => topIds,
      } as Response;
    }

    const match = url.match(/\/item\/(\d+)\.json/);
    if (match) {
      const id = match[1];
      const item = itemsMap[id];
      if (item) {
        return {
          ok: true,
          json: async () => item,
        } as Response;
      }
    }

    return { ok: false, status: 404 } as Response;
  };

  // Fixed reference time: 2 hours after item 10001 (time: 1792350000 -> 2026-10-18T20:20:00Z approx)
  const now = new Date(1792350000 * 1000 + 2 * 3600 * 1000);

  const stories = await fetchHackerNewsStories({
    limit: 10,
    minScore: 80,
    fetchFn: mockFetch as any,
    now,
  });

  // Expected items:
  // 10001 (Claude 3.7, score 320, AI keyword): PASS
  // 10002 (score 45 < 80): REJECTED
  // 10003 (woodcraft, score 210, non-AI): REJECTED
  // 10004 (GPT-4o, age > 24h): REJECTED
  // 10005 (Blackwell chips / coding, score 195, AI keyword): PASS
  assert.equal(stories.length, 2);

  const titles = stories.map((s) => s.title);
  assert.ok(titles.some((t) => t.includes('Claude 3.7 Sonnet')));
  assert.ok(titles.some((t) => t.includes('Blackwell chips')));

  assert.equal(stories[0].source, 'Hacker News');
  assert.ok(stories[0].id.length === 16);
});

test('fetchHackerNewsStories handles network failure gracefully without throwing', async () => {
  const failingFetch = async () => {
    throw new Error('Connection refused');
  };

  const stories = await fetchHackerNewsStories({
    fetchFn: failingFetch as any,
  });

  assert.deepEqual(stories, []);
});

test('fetchRssFeed handles network error gracefully', async () => {
  const failingFetch = async () => {
    return { ok: false, status: 500 } as Response;
  };

  const items = await fetchRssFeed('https://example.com/feed.xml', 'Failing Feed', failingFetch as any);
  assert.deepEqual(items, []);
});
