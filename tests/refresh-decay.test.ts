import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import matter from 'gray-matter';
import {
  detectStrikingDistance,
  detectContentDecay,
  buildStrikingDistanceQueueItems,
  buildContentDecayQueueItems,
  extractSlugFromPage,
} from '../lib/pipeline/refresh/detect';
import {
  loadRefreshQueue,
  saveRefreshQueue,
  upsertRefreshQueue,
  updateRefreshItemStatus,
} from '../lib/pipeline/refresh/queue';
import {
  executeRefreshAction,
  unlinkMarkdownUrl,
} from '../lib/pipeline/refresh/execute';
import { draftSchema } from '../lib/pipeline/draft-schema';
import type { GscSearchRow } from '../lib/pipeline/analytics/types';
import type { RefreshQueueFile, RefreshQueueItem } from '../lib/pipeline/refresh/types';

test('extractSlugFromPage: extracts slug from clean path or full URL', () => {
  assert.equal(extractSlugFromPage('https://mysite.com/blog/best-ai-tools'), 'best-ai-tools');
  assert.equal(extractSlugFromPage('/blog/best-ai-tools'), 'best-ai-tools');
  assert.equal(extractSlugFromPage('/ai-writing/best-ai-tools'), 'best-ai-tools');
  assert.equal(extractSlugFromPage('/best-ai-tools'), 'best-ai-tools');
});

test('detectStrikingDistance: isolates queries with pos 5.0-20.0 and impressions >= 50', () => {
  const rows: GscSearchRow[] = [
    // Eligible: position 6.0, 100 impr -> score 100 * (21 - 6) = 1500
    {
      country: 'USA',
      page: '/blog/best-ai-tools',
      query: 'best ai writing assistants 2026',
      clicks: 10,
      impressions: 100,
      ctr: 0.1,
      position: 6.0,
    },
    // Eligible: position 15.0, 200 impr -> score 200 * (21 - 15) = 1200
    {
      country: 'GBR',
      page: '/blog/best-ai-tools',
      query: 'top ai tools for marketing',
      clicks: 5,
      impressions: 200,
      ctr: 0.025,
      position: 15.0,
    },
    // Boundary: exactly 5.0, 50 impr -> score 50 * (21 - 5) = 800
    {
      country: 'USA',
      page: '/blog/chatgpt-tips',
      query: 'chatgpt prompt engineering',
      clicks: 2,
      impressions: 50,
      ctr: 0.04,
      position: 5.0,
    },
    // Boundary: exactly 20.0, 60 impr -> score 60 * (21 - 20) = 60
    {
      country: 'CAN',
      page: '/blog/claude-coding',
      query: 'claude 3.7 sonnet coding tips',
      clicks: 1,
      impressions: 60,
      ctr: 0.016,
      position: 20.0,
    },
    // Excluded: position too high (page 1 top 4)
    {
      country: 'USA',
      page: '/blog/best-ai-tools',
      query: 'ai writing',
      clicks: 120,
      impressions: 1000,
      ctr: 0.12,
      position: 3.2,
    },
    // Excluded: position > 20.0
    {
      country: 'AUS',
      page: '/blog/best-ai-tools',
      query: 'cheap ai tools',
      clicks: 0,
      impressions: 300,
      ctr: 0,
      position: 22.4,
    },
    // Excluded: impressions < 50
    {
      country: 'USA',
      page: '/blog/best-ai-tools',
      query: 'obscure tool review',
      clicks: 1,
      impressions: 45,
      ctr: 0.02,
      position: 8.5,
    },
  ];

  const results = detectStrikingDistance(rows);
  assert.equal(results.length, 4);

  // Assert opportunity score ordering (descending)
  assert.equal(results[0].query, 'best ai writing assistants 2026');
  assert.equal(results[0].opportunityScore, 1500);

  assert.equal(results[1].query, 'top ai tools for marketing');
  assert.equal(results[1].opportunityScore, 1200);

  assert.equal(results[2].query, 'chatgpt prompt engineering');
  assert.equal(results[2].opportunityScore, 800);

  assert.equal(results[3].query, 'claude 3.7 sonnet coding tips');
  assert.equal(results[3].opportunityScore, 60);
});

test('detectContentDecay: enforces >= 90d age, >= 100 prior impressions, and >= 25% drop', () => {
  const now = new Date('2026-10-18T12:00:00Z');

  const pages = [
    // Decay: 120 days old, prior 500 impr, current 300 impr -> 40% drop (decay score: 0.40 * 500 = 200)
    {
      page: '/blog/mature-decaying-post',
      publishedAt: '2026-06-20T00:00:00Z', // 120 days old
      current30d: { impressions: 300, clicks: 15 },
      prior30d: { impressions: 500, clicks: 25 },
    },
    // Decay via click loss: 100 days old, prior 200 impr/40 clicks, current 190 impr/20 clicks -> 50% click drop
    {
      page: '/blog/click-decaying-post',
      publishedAt: '2026-07-10T00:00:00Z', // 100 days old
      current30d: { impressions: 190, clicks: 20 },
      prior30d: { impressions: 200, clicks: 40 },
    },
    // Too young: 60 days old (< 90 days), drop is 50%
    {
      page: '/blog/young-post',
      publishedAt: '2026-08-19T00:00:00Z', // 60 days old
      current30d: { impressions: 100, clicks: 5 },
      prior30d: { impressions: 200, clicks: 10 },
    },
    // Too low volume: 150 days old, prior impressions 80 (< 100 baseline floor)
    {
      page: '/blog/low-volume-post',
      publishedAt: '2026-05-01T00:00:00Z',
      current30d: { impressions: 40, clicks: 2 },
      prior30d: { impressions: 80, clicks: 4 },
    },
    // Stable: 150 days old, prior 500, current 450 -> only 10% drop (< 25%)
    {
      page: '/blog/healthy-post',
      publishedAt: '2026-05-01T00:00:00Z',
      current30d: { impressions: 450, clicks: 25 },
      prior30d: { impressions: 500, clicks: 28 },
    },
  ];

  const decays = detectContentDecay(pages, { now });
  assert.equal(decays.length, 2);

  // Highest decay score first
  assert.equal(decays[0].slug, 'mature-decaying-post');
  assert.equal(decays[0].dropImpressionsPct, 0.4);
  assert.equal(decays[0].decayScore, 200);

  assert.equal(decays[1].slug, 'click-decaying-post');
  assert.equal(decays[1].dropClicksPct, 0.5);
  assert.equal(decays[1].decayScore, 100);
});

test('queue: load, save, and upsert deduplication preserves applied history', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'refresh-queue-test-'));
  const testQueuePath = join(tmpDir, 'refresh-queue.json');

  try {
    // 1. Initial load from non-existent file
    const queue0 = loadRefreshQueue(testQueuePath);
    assert.equal(queue0.items.length, 0);

    // 2. Upsert two new items
    const item1: RefreshQueueItem = {
      id: 'refresh-post-a-2026-10',
      slug: 'post-a',
      silo: 'ai-writing',
      type: 'striking-distance',
      priority: 8,
      detectedAt: '2026-10-18T10:00:00Z',
      status: 'pending',
      diagnostics: { currentImpressions: 500 },
      suggestedActions: [{ action: 'bump-date-modified' }],
    };

    const item2: RefreshQueueItem = {
      id: 'refresh-post-b-2026-10',
      slug: 'post-b',
      silo: 'ai-writing',
      type: 'content-decay',
      priority: 6,
      detectedAt: '2026-10-18T10:00:00Z',
      status: 'pending',
      diagnostics: { currentImpressions: 200 },
      suggestedActions: [{ action: 'bump-date-modified' }],
    };

    const updated1 = upsertRefreshQueue(queue0, [item1, item2]);
    saveRefreshQueue(updated1, testQueuePath);

    // Verify written file
    const loaded1 = loadRefreshQueue(testQueuePath);
    assert.equal(loaded1.items.length, 2);

    // 3. Mark item1 as 'applied'
    updateRefreshItemStatus('refresh-post-a-2026-10', 'applied', testQueuePath);
    const loadedAfterApply = loadRefreshQueue(testQueuePath);
    const postA = loadedAfterApply.items.find((i) => i.id === 'refresh-post-a-2026-10');
    assert.equal(postA?.status, 'applied');
    assert.ok(postA?.appliedAt);

    // 4. Re-run detection: upsert item1 again with status 'pending' in new payload
    const item1Rescanned: RefreshQueueItem = {
      id: 'refresh-post-a-2026-10',
      slug: 'post-a',
      silo: 'ai-writing',
      type: 'striking-distance',
      priority: 9, // higher priority
      detectedAt: '2026-10-18T12:00:00Z',
      status: 'pending',
      diagnostics: { currentImpressions: 600 },
      suggestedActions: [{ action: 'bump-date-modified' }],
    };

    const merged = upsertRefreshQueue(loadedAfterApply, [item1Rescanned]);
    assert.equal(merged.items.length, 2); // No duplicates!

    // Crucial: status 'applied' must be preserved, not overwritten back to 'pending'
    const postARescanned = merged.items.find((i) => i.id === 'refresh-post-a-2026-10');
    assert.equal(postARescanned?.status, 'applied');
    assert.equal(postARescanned?.appliedAt, postA?.appliedAt);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('unlinkMarkdownUrl: cleanly removes link wrapper preserving anchor prose', () => {
  const content =
    'Check out the [Claude 3.7 documentation](https://broken-domain-404.com/docs) for full API specs. Also see [Healthy Link](https://google.com).';

  const repaired = unlinkMarkdownUrl(content, 'https://broken-domain-404.com/docs');

  assert.equal(
    repaired,
    'Check out the Claude 3.7 documentation for full API specs. Also see [Healthy Link](https://google.com).'
  );
});

test('executeRefreshAction: bumps updatedAt and respects FAQ boundary (max 5)', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'refresh-exec-test-'));

  try {
    // 1. Create a sample MDX file with exactly 4 FAQs
    const postSlug = 'test-refresh-article';
    const samplePostContent = `---
title: "Best AI Writing Assistants in 2026: 7 Tools Compared"
description: "We tested seven AI writing assistants for output quality, editing control, pricing, and originality safeguards to find the best pick for bloggers and marketers."
slug: "test-refresh-article"
publishedAt: "2026-05-01T00:00:00.000Z"
updatedAt: "2026-05-01T00:00:00.000Z"
silo: "ai-writing"
tldr: "A comprehensive roundup of the leading AI coding assistants tested for real-world development workflows."
faq:
  - q: "Question 1"
    a: "Answer 1"
  - q: "Question 2"
    a: "Answer 2"
  - q: "Question 3"
    a: "Answer 3"
  - q: "Question 4"
    a: "Answer 4"
---

# Article Heading

Here is paragraph prose with a [Dead Outbound Link](https://deadlink.example.com/not-found) to repair.
`;

    const postPath = join(tmpDir, `${postSlug}.mdx`);
    writeFileSync(postPath, samplePostContent, 'utf8');

    // 2. Test Dry Run mode first
    const dryRunRes = await executeRefreshAction(
      {
        postSlug,
        actions: ['bump-date-modified', 'inject-faq', 'repair-links'],
        newFaq: { q: 'Question 5', a: 'Answer 5' },
        brokenLinks: ['https://deadlink.example.com/not-found'],
        dryRun: true,
      },
      { postsDir: tmpDir }
    );

    assert.equal(dryRunRes.success, true);
    assert.equal(dryRunRes.applied, false);
    // File on disk must remain untouched in dryRun
    const contentAfterDryRun = readFileSync(postPath, 'utf8');
    assert.equal(contentAfterDryRun, samplePostContent);

    // 3. Test Live Run: inject 5th FAQ (valid transition from 4 to 5)
    const liveRes1 = await executeRefreshAction(
      {
        postSlug,
        actions: ['bump-date-modified', 'inject-faq', 'repair-links'],
        newFaq: { q: 'Question 5', a: 'Answer 5' },
        brokenLinks: ['https://deadlink.example.com/not-found'],
        dryRun: false,
      },
      { postsDir: tmpDir }
    );

    assert.equal(liveRes1.success, true);
    assert.equal(liveRes1.applied, true);

    const postAfterLive1 = matter(readFileSync(postPath, 'utf8'));
    assert.notEqual(postAfterLive1.data.updatedAt, '2026-05-01T00:00:00.000Z');
    assert.equal(postAfterLive1.data.faq.length, 5);
    assert.equal(postAfterLive1.data.faq[4].q, 'Question 5');
    assert.ok(
      postAfterLive1.content.includes('Dead Outbound Link to repair.'),
      'Link was cleanly unlinked'
    );
    assert.ok(!postAfterLive1.content.includes('https://deadlink.example.com/not-found'));

    // Validate frontmatter against schema
    const parse1 = draftSchema.safeParse(postAfterLive1.data);
    assert.ok(parse1.success, `Schema validation failed: ${parse1.error?.message}`);

    // 4. Test FAQ Boundary Guard: Attempt to inject a 6th FAQ into an article that ALREADY HAS 5 FAQs
    const liveRes2 = await executeRefreshAction(
      {
        postSlug,
        actions: ['inject-faq'],
        newFaq: { q: 'Question 6 (Overflow)', a: 'Answer 6' },
        dryRun: false,
      },
      { postsDir: tmpDir }
    );

    assert.equal(liveRes2.success, true);
    const postAfterLive2 = matter(readFileSync(postPath, 'utf8'));

    // MUST NOT exceed 5 items!
    assert.equal(postAfterLive2.data.faq.length, 5);
    // Last item was replaced with the new question
    assert.equal(postAfterLive2.data.faq[4].q, 'Question 6 (Overflow)');

    // Crucial check: DraftSchema still parses without error!
    const parse2 = draftSchema.safeParse(postAfterLive2.data);
    assert.ok(
      parse2.success,
      `DraftSchema failed when 6th FAQ attempted: ${parse2.error?.message}`
    );
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});
