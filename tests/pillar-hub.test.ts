import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCollectionPageJsonLd } from '../lib/seo/jsonld';
import {
  analyzeSiloClusters,
  queueCornerstoneGuide,
} from '../lib/pipeline/hubs/pillar';
import { saveShard, loadShard } from '../lib/pipeline/registry';
import { SILO_SLUGS, SILOS } from '../lib/silos';
import { SITE_NAME, SITE_URL } from '../lib/site';
import type { RegistryEntry, RegistryShard } from '../lib/pipeline/types';

function createMockShard(silo: string, entries: Partial<RegistryEntry>[]): RegistryShard {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    keywords: entries.map((e, idx) => ({
      id: e.id ?? `kw-${silo}-${idx + 1}`,
      keyword: e.keyword ?? `test keyword ${idx + 1}`,
      silo: silo as any,
      stage: e.stage ?? 'published',
      createdAt: e.createdAt ?? new Date('2026-06-01T00:00:00Z').toISOString(),
      publishedAt: e.publishedAt ?? new Date('2026-08-01T00:00:00Z').toISOString(),
      updatedAt: e.updatedAt ?? new Date().toISOString(),
      brief: { completedAt: new Date('2026-06-01T00:00:00Z').toISOString() },
      outline: { completedAt: new Date('2026-06-01T00:00:00Z').toISOString(), lint: 'pass' },
      qa: { passedAt: new Date('2026-08-01T00:00:00Z').toISOString() },
      draft: e.draft ?? {
        slug: `post-${silo}-${idx + 1}`,
        attempts: 1,
      },
      ...e,
    })) as RegistryEntry[],
  };
}

test('pillar hub: buildCollectionPageJsonLd produces valid Schema.org CollectionPage structure', () => {
  const silo = SILOS['ai-coding'];
  const posts = [
    {
      title: 'ChatGPT vs Claude for Coding',
      slug: 'chatgpt-vs-claude-for-coding',
      publishedAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-10-18T00:00:00.000Z',
    },
    {
      title: 'Cursor AI vs Copilot',
      slug: 'cursor-ai-vs-github-copilot',
      publishedAt: '2026-08-15T00:00:00.000Z',
    },
  ];

  const canonical = 'https://exclusivesources.online/ai-coding';
  const jsonLd = buildCollectionPageJsonLd(silo, posts, canonical);

  assert.equal(jsonLd['@context'], 'https://schema.org');
  assert.equal(jsonLd['@type'], 'CollectionPage');
  assert.equal(jsonLd.name, silo.landingTitle);
  assert.equal(jsonLd.description, silo.metaDescription);
  assert.equal(jsonLd.url, canonical);
  assert.equal(jsonLd.publisher['@type'], 'Organization');
  assert.equal(jsonLd.publisher.name, SITE_NAME);
  assert.equal(jsonLd.publisher.url, SITE_URL);

  assert.equal(jsonLd.hasPart.length, 2);
  assert.equal(jsonLd.hasPart[0]['@type'], 'BlogPosting');
  assert.equal(jsonLd.hasPart[0].headline, 'ChatGPT vs Claude for Coding');
  assert.equal(
    jsonLd.hasPart[0].url,
    'https://exclusivesources.online/blog/chatgpt-vs-claude-for-coding'
  );
  assert.equal(jsonLd.hasPart[0].datePublished, '2026-08-01T00:00:00.000Z');
  assert.equal((jsonLd.hasPart[0] as any).dateModified, '2026-10-18T00:00:00.000Z');

  // Post without updatedAt should not have dateModified
  assert.equal((jsonLd.hasPart[1] as any).dateModified, undefined);
});

test('pillar hub: cluster threshold detection (<8 vs >=8 posts)', () => {
  const tmpDir = join(process.cwd(), 'tmp-test-pillar-threshold');
  const keywordsDir = join(tmpDir, 'keywords');
  const postsDir = join(tmpDir, 'posts');
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(keywordsDir, { recursive: true });
  mkdirSync(postsDir, { recursive: true });

  // 1. Silo 0 has 5 posts (< 8 -> isPillar: false)
  const entriesSilo0 = Array.from({ length: 5 }, (_, i) => ({
    id: `p0-${i + 1}`,
    stage: 'published' as const,
    draft: { slug: `p0-post-${i + 1}`, attempts: 1 },
  }));
  saveShard(keywordsDir, SILO_SLUGS[0], createMockShard(SILO_SLUGS[0], entriesSilo0));

  // 2. Silo 1 has 9 posts (>= 8 -> isPillar: true)
  const entriesSilo1 = Array.from({ length: 9 }, (_, i) => ({
    id: `p1-${i + 1}`,
    stage: 'published' as const,
    draft: { slug: `p1-post-${i + 1}`, attempts: 1 },
  }));
  saveShard(keywordsDir, SILO_SLUGS[1], createMockShard(SILO_SLUGS[1], entriesSilo1));

  const reports = analyzeSiloClusters(keywordsDir, postsDir);

  const report0 = reports.find((r) => r.silo === SILO_SLUGS[0]);
  assert.ok(report0);
  assert.equal(report0.postCount, 5);
  assert.equal(report0.isPillar, false);

  const report1 = reports.find((r) => r.silo === SILO_SLUGS[1]);
  assert.ok(report1);
  assert.equal(report1.postCount, 9);
  assert.equal(report1.isPillar, true);

  rmSync(tmpDir, { recursive: true, force: true });
});

test('pillar hub: cornerstone guide queuing and detection', () => {
  const tmpDir = join(process.cwd(), 'tmp-test-pillar-cornerstone');
  const keywordsDir = join(tmpDir, 'keywords');
  const postsDir = join(tmpDir, 'posts');
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(keywordsDir, { recursive: true });
  mkdirSync(postsDir, { recursive: true });

  const silo = SILO_SLUGS[0];
  const entries = Array.from({ length: 8 }, (_, i) => ({
    id: `kw-c-${i + 1}`,
    stage: 'published' as const,
    draft: { slug: `post-c-${i + 1}`, attempts: 1 },
  }));

  saveShard(keywordsDir, silo, createMockShard(silo, entries));

  // Initial report: isPillar: true, hasCornerstoneGuide: false
  const initialReports = analyzeSiloClusters(keywordsDir, postsDir);
  const initialReport = initialReports.find((r) => r.silo === silo);
  assert.ok(initialReport);
  assert.equal(initialReport.isPillar, true);
  assert.equal(initialReport.hasCornerstoneGuide, false);

  // Queue cornerstone guide
  const queued = queueCornerstoneGuide(silo, keywordsDir);
  assert.equal(queued, true);

  // Verify shard entry was created
  const shardAfter = loadShard(keywordsDir, silo);
  const queuedEntry = shardAfter.keywords.find((k) => k.id.includes('complete-guide') || k.id.includes('guide'));
  assert.ok(queuedEntry);
  assert.equal(queuedEntry.stage, 'filtered');
  assert.equal(queuedEntry.silo, silo);
  assert.match(queuedEntry.keyword, /complete architectural guide/);

  // Second queuing attempt should be idempotent and return false
  const queuedSecond = queueCornerstoneGuide(silo, keywordsDir);
  assert.equal(queuedSecond, false);

  // Now simulate the cornerstone guide becoming published
  queuedEntry.stage = 'published';
  queuedEntry.draft = {
    slug: `${silo}-complete-guide`,
    attempts: 1,
  };
  queuedEntry.qa = { passedAt: new Date().toISOString() };
  saveShard(keywordsDir, silo, shardAfter);

  const updatedReports = analyzeSiloClusters(keywordsDir, postsDir);
  const updatedReport = updatedReports.find((r) => r.silo === silo);
  assert.ok(updatedReport);
  assert.equal(updatedReport.hasCornerstoneGuide, true);
  assert.equal(updatedReport.cornerstoneSlug, `${silo}-complete-guide`);

  rmSync(tmpDir, { recursive: true, force: true });
});

test('pillar hub: bidirectional link mesh check flags orphan spokes lacking pillar/cornerstone links', () => {
  const tmpDir = join(process.cwd(), 'tmp-test-pillar-mesh');
  const keywordsDir = join(tmpDir, 'keywords');
  const postsDir = join(tmpDir, 'posts');
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(keywordsDir, { recursive: true });
  mkdirSync(postsDir, { recursive: true });

  const silo = SILO_SLUGS[0]; // e.g. ai-writing
  const cornerstoneSlug = `${silo}-complete-guide`;

  const entries: Partial<RegistryEntry>[] = [
    {
      id: 'spoke-healthy',
      stage: 'published',
      draft: { slug: 'spoke-healthy', attempts: 1 },
    },
    {
      id: 'spoke-orphan',
      stage: 'published',
      draft: { slug: 'spoke-orphan', attempts: 1 },
    },
    {
      id: 'cornerstone-post',
      stage: 'published',
      draft: { slug: cornerstoneSlug, attempts: 1 },
    },
  ];

  saveShard(keywordsDir, silo, createMockShard(silo, entries));

  // Write MDX for healthy spoke (contains link to `/${silo}`)
  writeFileSync(
    join(postsDir, 'spoke-healthy.mdx'),
    `---\ntitle: "Healthy"\n---\nCheck our [Silo Overview](/${silo}) for more info.`
  );

  // Write MDX for orphan spoke (no link to `/${silo}` or cornerstone)
  writeFileSync(
    join(postsDir, 'spoke-orphan.mdx'),
    `---\ntitle: "Orphan"\n---\nThis article has external links only: [OpenAI](https://openai.com).`
  );

  // Write MDX for cornerstone post itself
  writeFileSync(
    join(postsDir, `${cornerstoneSlug}.mdx`),
    `---\ntitle: "Cornerstone"\n---\nThis is the flagship guide.`
  );

  const reports = analyzeSiloClusters(keywordsDir, postsDir);
  const report = reports.find((r) => r.silo === silo);
  assert.ok(report);

  // Orphan spoke should be flagged
  const missing = report.missingBidirectionalLinks;
  assert.equal(missing.length, 1);
  assert.equal(missing[0].spokeSlug, 'spoke-orphan');
  assert.match(missing[0].reason, /Missing backlink to silo landing/);

  // Healthy spoke and cornerstone guide itself should NOT be flagged
  assert.ok(!missing.some((m) => m.spokeSlug === 'spoke-healthy'));
  assert.ok(!missing.some((m) => m.spokeSlug === cornerstoneSlug));

  rmSync(tmpDir, { recursive: true, force: true });
});
