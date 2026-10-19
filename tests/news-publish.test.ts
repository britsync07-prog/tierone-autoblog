import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import matter from 'gray-matter';

import {
  checkAlreadyPublishedToday,
  runDailyNewsPublisher,
  toRegistryId,
} from '../scripts/publish-daily-news';
import { draftSchema } from '../lib/pipeline/draft-schema';
import { loadCoveredLedger } from '../lib/pipeline/news/ledger';
import { loadShard } from '../lib/pipeline/registry';

test('checkAlreadyPublishedToday accurately detects same-day ai-news posts', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'news-check-today-'));

  try {
    const testDate = new Date('2026-10-19T14:30:00.000Z');

    // 1. Empty directory -> not published
    const emptyCheck = checkAlreadyPublishedToday(tempDir, testDate);
    assert.equal(emptyCheck.alreadyPublished, false);

    // 2. Post from a different silo on the same date -> not published
    const nonNewsPost = `---
title: "Best AI Coding Assistants 2026"
description: "Comparison of top AI coding tools."
slug: "best-ai-coding-assistants-2026"
publishedAt: "2026-10-19T10:00:00.000Z"
silo: "ai-coding"
---
Content here.`;
    writeFileSync(join(tempDir, 'best-ai-coding.mdx'), nonNewsPost, 'utf8');

    const nonNewsCheck = checkAlreadyPublishedToday(tempDir, testDate);
    assert.equal(nonNewsCheck.alreadyPublished, false);

    // 3. Post in ai-news from yesterday -> not published today
    const yesterdayNewsPost = `---
title: "Yesterday AI Model Launch"
description: "Model launch from yesterday."
slug: "yesterday-ai-model-launch"
publishedAt: "2026-10-18T18:00:00.000Z"
silo: "ai-news"
---
Content here.`;
    writeFileSync(join(tempDir, 'yesterday-news.mdx'), yesterdayNewsPost, 'utf8');

    const yesterdayCheck = checkAlreadyPublishedToday(tempDir, testDate);
    assert.equal(yesterdayCheck.alreadyPublished, false);

    // 4. Post in ai-news published on the same UTC date -> published today
    const todayNewsPost = `---
title: "Breaking News: Major AI Foundation Model Released"
description: "Full technical architectural breakdown."
slug: "breaking-ai-model-release"
publishedAt: "2026-10-19T06:15:00.000Z"
silo: "ai-news"
---
Content here.`;
    writeFileSync(join(tempDir, 'breaking-ai-model-release.mdx'), todayNewsPost, 'utf8');

    const todayCheck = checkAlreadyPublishedToday(tempDir, testDate);
    assert.equal(todayCheck.alreadyPublished, true);
    assert.equal(todayCheck.todaySlug, 'breaking-ai-model-release');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('runDailyNewsPublisher with dryRun and mock executes cleanly without writing files', async () => {
  const result = await runDailyNewsPublisher({
    dryRun: true,
    mock: true,
    now: new Date('2026-10-25T08:00:00.000Z'),
  });

  assert.equal(result.success, true);
  assert.equal(result.reason, 'dry_run');
  assert.ok(result.slug && result.slug.length > 0);
  assert.ok(result.candidateTitle && result.candidateTitle.length > 0);
});

test('runDailyNewsPublisher enforces idempotency lock unless force is set', async () => {
  const baseTemp = mkdtempSync(join(tmpdir(), 'news-publish-idempotency-'));
  const postsDir = join(baseTemp, 'posts');
  const keywordsDir = join(baseTemp, 'keywords');
  const ledgerPath = join(baseTemp, 'covered.json');
  const testDate = new Date('2026-10-22T06:00:00.000Z');

  try {
    mkdirSync(postsDir, { recursive: true });
    mkdirSync(join(keywordsDir, 'ai-news'), { recursive: true });

    // Initialize clean registry shard
    writeFileSync(
      join(keywordsDir, 'ai-news', 'registry.json'),
      JSON.stringify({ version: 1, updatedAt: testDate.toISOString(), keywords: [] }, null, 2),
      'utf8',
    );

    // Initial run: publishes post
    const run1 = await runDailyNewsPublisher({
      postsDir,
      keywordsDir,
      ledgerPath,
      mock: true,
      now: testDate,
      force: false,
    });

    assert.equal(run1.success, true);
    assert.ok(run1.postPath && existsSync(run1.postPath));
    assert.ok(run1.slug);

    // Second run on same date: blocked by idempotency lock
    const run2 = await runDailyNewsPublisher({
      postsDir,
      keywordsDir,
      ledgerPath,
      mock: true,
      now: testDate,
      force: false,
    });

    assert.equal(run2.success, true);
    assert.equal(run2.reason, 'already_published');
    assert.equal(run2.slug, run1.slug);

    // Third run on same date with force: true -> bypasses idempotency
    const run3 = await runDailyNewsPublisher({
      postsDir,
      keywordsDir,
      ledgerPath,
      mock: true,
      now: testDate,
      force: true,
    });

    assert.equal(run3.success, true);
    assert.equal(run3.reason, undefined);
    assert.ok(run3.postPath && existsSync(run3.postPath));
  } finally {
    rmSync(baseTemp, { recursive: true, force: true });
  }
});

test('runDailyNewsPublisher updates covered.json and registry.json correctly', async () => {
  const baseTemp = mkdtempSync(join(tmpdir(), 'news-publish-ledger-'));
  const postsDir = join(baseTemp, 'posts');
  const keywordsDir = join(baseTemp, 'keywords');
  const ledgerPath = join(baseTemp, 'covered.json');
  const testDate = new Date('2026-10-23T06:00:00.000Z');

  try {
    mkdirSync(postsDir, { recursive: true });
    mkdirSync(join(keywordsDir, 'ai-news'), { recursive: true });

    writeFileSync(
      join(keywordsDir, 'ai-news', 'registry.json'),
      JSON.stringify({ version: 1, updatedAt: testDate.toISOString(), keywords: [] }, null, 2),
      'utf8',
    );

    const result = await runDailyNewsPublisher({
      postsDir,
      keywordsDir,
      ledgerPath,
      mock: true,
      now: testDate,
    });

    assert.equal(result.success, true);

    // 1. Verify covered.json entry
    const ledger = loadCoveredLedger(ledgerPath);
    assert.ok(ledger.events.length >= 1);
    const event = ledger.events[0];
    assert.ok(event.id);
    assert.ok(event.title);
    assert.ok(event.normalizedTitle);
    assert.ok(event.sourceUrl);
    assert.ok(event.canonicalDomain);
    assert.ok(event.publishedDate);
    assert.ok(event.coveredAt);
    assert.equal(event.postSlug, result.slug);

    // 2. Verify registry.json entry
    const shard = loadShard(keywordsDir, 'ai-news');
    assert.ok(shard.keywords.length >= 1);
    const registryEntry = shard.keywords[0];
    assert.equal(registryEntry.silo, 'ai-news');
    assert.equal(registryEntry.stage, 'published');
    assert.equal(registryEntry.draft?.slug, result.slug);
    assert.ok(registryEntry.qa?.passedAt);
  } finally {
    rmSync(baseTemp, { recursive: true, force: true });
  }
});

test('Emitted MDX frontmatter strictly conforms to draftSchema', async () => {
  const baseTemp = mkdtempSync(join(tmpdir(), 'news-publish-schema-'));
  const postsDir = join(baseTemp, 'posts');
  const keywordsDir = join(baseTemp, 'keywords');
  const ledgerPath = join(baseTemp, 'covered.json');
  const testDate = new Date('2026-10-24T06:00:00.000Z');

  try {
    mkdirSync(postsDir, { recursive: true });
    mkdirSync(join(keywordsDir, 'ai-news'), { recursive: true });

    writeFileSync(
      join(keywordsDir, 'ai-news', 'registry.json'),
      JSON.stringify({ version: 1, updatedAt: testDate.toISOString(), keywords: [] }, null, 2),
      'utf8',
    );

    const result = await runDailyNewsPublisher({
      postsDir,
      keywordsDir,
      ledgerPath,
      mock: true,
      now: testDate,
    });

    assert.ok(result.postPath);
    const mdxContent = readFileSync(result.postPath, 'utf8');
    const { data: frontmatter } = matter(mdxContent);

    // Validate frontmatter through single source draftSchema
    const validated = draftSchema.parse(frontmatter);
    assert.equal(validated.silo, 'ai-news');
    assert.equal(validated.slug, result.slug);
    assert.ok(validated.title.length >= 50 && validated.title.length <= 60);
    assert.ok(validated.description.length >= 110 && validated.description.length <= 160);
    assert.ok(validated.tldr && validated.tldr.length >= 80);
    assert.ok(validated.faq && validated.faq.length >= 3);
  } finally {
    rmSync(baseTemp, { recursive: true, force: true });
  }
});

test('toRegistryId generates valid registry IDs conforming to regex constraint', () => {
  const cases = [
    {
      slug: 'anthropic-claude-3-7-sonnet-hybrid-reasoning-release',
      expected: 'anthropic-claude-3-7-sonnet',
    },
    {
      slug: 'deepseek-reasoning-model-open-weights',
      expected: 'deepseek-reasoning-model-open-weights',
    },
    {
      slug: 'singleword',
      expected: 'singleword',
    },
    {
      slug: 'one-two-three-four-five-six-seven',
      expected: 'one-two-three-four-five',
    },
  ];

  const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+){0,4}$/;

  for (const { slug, expected } of cases) {
    const id = toRegistryId(slug);
    assert.equal(id, expected);
    assert.ok(ID_RE.test(id), `ID "${id}" must match /^[a-z0-9]+(?:-[a-z0-9]+){0,4}$/`);
  }
});
