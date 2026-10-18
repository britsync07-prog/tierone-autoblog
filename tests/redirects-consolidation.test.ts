import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  formatForNextConfig,
  loadRedirects,
  saveRedirects,
  validateRedirectEntry,
  type RedirectEntry,
} from '../lib/pipeline/redirects/registry';
import { retireAndRedirectPost } from '../lib/pipeline/redirects/retire';
import { loadShard, saveShard } from '../lib/pipeline/registry';
import type { RegistryShard } from '../lib/pipeline/types';

const FIXTURES_DIR = join(process.cwd(), '.test-tmp', 'redirects-test');

function setupFixtures() {
  rmSync(FIXTURES_DIR, { recursive: true, force: true });
  mkdirSync(FIXTURES_DIR, { recursive: true });
}

function cleanupFixtures() {
  rmSync(FIXTURES_DIR, { recursive: true, force: true });
}

test('loadRedirects: returns empty array when file does not exist', () => {
  setupFixtures();
  try {
    const missingFile = join(FIXTURES_DIR, 'non-existent.json');
    const result = loadRedirects(missingFile);
    assert.deepEqual(result, []);
  } finally {
    cleanupFixtures();
  }
});

test('loadRedirects: returns empty array on invalid or corrupt JSON', () => {
  setupFixtures();
  try {
    const corruptFile = join(FIXTURES_DIR, 'corrupt.json');
    writeFileSync(corruptFile, '{ invalid json [', 'utf8');
    const result = loadRedirects(corruptFile);
    assert.deepEqual(result, []);

    const nonArrayFile = join(FIXTURES_DIR, 'not-array.json');
    writeFileSync(nonArrayFile, '{"foo": "bar"}', 'utf8');
    const notArrayResult = loadRedirects(nonArrayFile);
    assert.deepEqual(notArrayResult, []);
  } finally {
    cleanupFixtures();
  }
});

test('loadRedirects & saveRedirects: round trips valid redirect entries atomically', () => {
  setupFixtures();
  try {
    const targetFile = join(FIXTURES_DIR, 'redirects.json');
    const entries: RedirectEntry[] = [
      {
        source: '/blog/old-post-a',
        destination: '/blog/new-post-a',
        permanent: true,
        reason: 'Consolidated into pillar post',
        retiredAt: '2026-10-18T12:00:00.000Z',
      },
      {
        source: '/blog/old-post-b',
        destination: '/blog/pillar-guide',
        permanent: true,
      },
    ];

    saveRedirects(entries, targetFile);
    assert.ok(existsSync(targetFile));

    const loaded = loadRedirects(targetFile);
    assert.equal(loaded.length, 2);
    assert.equal(loaded[0].source, '/blog/old-post-a');
    assert.equal(loaded[0].destination, '/blog/new-post-a');
    assert.equal(loaded[0].permanent, true);
    assert.equal(loaded[0].reason, 'Consolidated into pillar post');
    assert.equal(loaded[1].source, '/blog/old-post-b');
    assert.equal(loaded[1].destination, '/blog/pillar-guide');
  } finally {
    cleanupFixtures();
  }
});

test('validateRedirectEntry: catches missing leading slashes and malformed paths', () => {
  const existing: RedirectEntry[] = [];
  const badSource = validateRedirectEntry(
    { source: 'blog/old', destination: '/blog/new', permanent: true },
    existing,
  );
  assert.equal(badSource.valid, false);
  assert.match(badSource.error || '', /must start with '\/'/);

  const badDest = validateRedirectEntry(
    { source: '/blog/old', destination: 'blog/new', permanent: true },
    existing,
  );
  assert.equal(badDest.valid, false);
  assert.match(badDest.error || '', /must start with '\/'/);
});

test('validateRedirectEntry: catches self-referential loop (A -> A)', () => {
  const existing: RedirectEntry[] = [];
  const loop = validateRedirectEntry(
    { source: '/blog/same-post', destination: '/blog/same-post', permanent: true },
    existing,
  );
  assert.equal(loop.valid, false);
  assert.match(loop.error || '', /Self-referential redirect loop/);
});

test('validateRedirectEntry: catches duplicate source rules', () => {
  const existing: RedirectEntry[] = [
    { source: '/blog/post-1', destination: '/blog/post-target', permanent: true },
  ];
  const dup = validateRedirectEntry(
    { source: '/blog/post-1', destination: '/blog/another-target', permanent: true },
    existing,
  );
  assert.equal(dup.valid, false);
  assert.match(dup.error || '', /Duplicate redirect source/);
});

test('validateRedirectEntry: catches direct circular pair (A -> B and B -> A)', () => {
  const existing: RedirectEntry[] = [
    { source: '/blog/post-a', destination: '/blog/post-b', permanent: true },
  ];
  const circular = validateRedirectEntry(
    { source: '/blog/post-b', destination: '/blog/post-a', permanent: true },
    existing,
  );
  assert.equal(circular.valid, false);
  assert.match(circular.error || '', /Circular redirect/);
});

test('validateRedirectEntry: catches multi-hop transitive cycles (A -> B -> C -> A)', () => {
  const existing: RedirectEntry[] = [
    { source: '/blog/post-b', destination: '/blog/post-c', permanent: true },
    { source: '/blog/post-c', destination: '/blog/post-a', permanent: true },
  ];
  const circularChain = validateRedirectEntry(
    { source: '/blog/post-a', destination: '/blog/post-b', permanent: true },
    existing,
  );
  assert.equal(circularChain.valid, false);
  assert.match(circularChain.error || '', /Circular redirect/);
});

test('validateRedirectEntry: warns on multi-hop chains (A -> B when B -> C exists)', () => {
  const existing: RedirectEntry[] = [
    { source: '/blog/post-b', destination: '/blog/post-c', permanent: true },
  ];
  const chain = validateRedirectEntry(
    { source: '/blog/post-a', destination: '/blog/post-b', permanent: true },
    existing,
  );
  assert.equal(chain.valid, true);
  assert.ok(chain.warning);
  assert.equal(chain.resolvedDestination, '/blog/post-c');
});

test('formatForNextConfig: maps entries to Next.js redirects format', () => {
  const entries: RedirectEntry[] = [
    {
      source: '/blog/legacy-slug',
      destination: '/blog/new-slug',
      permanent: true,
      reason: 'Migrated',
      retiredAt: '2026-10-18T00:00:00.000Z',
    },
  ];
  const formatted = formatForNextConfig(entries);
  assert.deepEqual(formatted, [
    {
      source: '/blog/legacy-slug',
      destination: '/blog/new-slug',
      permanent: true,
    },
  ]);
});

test('retireAndRedirectPost: successfully relocates post to quarantine, updates registry, and appends redirect', async () => {
  setupFixtures();
  try {
    const postsDir = join(FIXTURES_DIR, 'content', 'posts');
    const quarantineDir = join(FIXTURES_DIR, 'content', 'quarantine');
    const keywordsDir = join(FIXTURES_DIR, 'content', 'keywords');
    const redirectsFile = join(FIXTURES_DIR, 'content', 'redirects.json');

    mkdirSync(postsDir, { recursive: true });
    mkdirSync(quarantineDir, { recursive: true });
    mkdirSync(join(keywordsDir, 'ai-writing'), { recursive: true });

    // 1. Create source post file
    const postSlug = 'legacy-cannibalized-post';
    const postPath = join(postsDir, `${postSlug}.mdx`);
    writeFileSync(
      postPath,
      '---\ntitle: Legacy Post\n---\n# Legacy Post Body Content\n',
      'utf8',
    );

    // 2. Create initial registry shard
    const initialShard: RegistryShard = {
      version: 1,
      updatedAt: new Date().toISOString(),
      keywords: [
        {
          id: postSlug,
          keyword: 'legacy cannibalized post',
          silo: 'ai-writing',
          stage: 'published',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          draft: { slug: postSlug },
          qa: { passedAt: new Date().toISOString() },
        },
      ],
    };
    saveShard(keywordsDir, 'ai-writing', initialShard);

    // 3. Create initial empty redirects file
    saveRedirects([], redirectsFile);

    // 4. Execute post retirement
    const result = await retireAndRedirectPost({
      slug: postSlug,
      destination: '/blog/new-pillar-guide-2026',
      reason: 'Cannibalized by pillar guide',
      postsDir,
      quarantineDir,
      keywordsDir,
      redirectsFile,
    });

    assert.equal(result.success, true);
    assert.equal(result.retired, true);
    assert.equal(result.redirectedFrom, `/blog/${postSlug}`);
    assert.equal(result.destination, '/blog/new-pillar-guide-2026');

    // 5. Assert source post file is removed from postsDir
    assert.equal(existsSync(postPath), false);

    // 6. Assert post file and audit report exist in quarantineDir
    const quarantinedPost = join(quarantineDir, `${postSlug}.mdx`);
    const quarantineReport = join(quarantineDir, `${postSlug}-report.json`);
    assert.equal(existsSync(quarantinedPost), true);
    assert.equal(existsSync(quarantineReport), true);

    // 7. Assert registry shard entry transitioned to 'quarantined'
    const updatedShard = loadShard(keywordsDir, 'ai-writing');
    const entry = updatedShard.keywords.find((k) => k.id === postSlug);
    assert.ok(entry);
    assert.equal(entry.stage, 'quarantined');
    assert.equal(entry.quarantine?.failedRule, '301-consolidated');
    assert.equal(entry.quarantine?.reportPath, 'content/redirects.json');

    // 8. Assert redirects file has the permanent 301 rule
    const redirects = loadRedirects(redirectsFile);
    assert.equal(redirects.length, 1);
    assert.equal(redirects[0].source, `/blog/${postSlug}`);
    assert.equal(redirects[0].destination, '/blog/new-pillar-guide-2026');
    assert.equal(redirects[0].permanent, true);
    assert.equal(redirects[0].reason, 'Cannibalized by pillar guide');
  } finally {
    cleanupFixtures();
  }
});

test('retireAndRedirectPost: dry run validates without modifying disk', async () => {
  setupFixtures();
  try {
    const postsDir = join(FIXTURES_DIR, 'content', 'posts');
    const quarantineDir = join(FIXTURES_DIR, 'content', 'quarantine');
    const keywordsDir = join(FIXTURES_DIR, 'content', 'keywords');
    const redirectsFile = join(FIXTURES_DIR, 'content', 'redirects.json');

    mkdirSync(postsDir, { recursive: true });
    const postSlug = 'dry-run-post';
    const postPath = join(postsDir, `${postSlug}.mdx`);
    writeFileSync(postPath, '---\ntitle: Dry Run Post\n---\n', 'utf8');
    saveRedirects([], redirectsFile);

    const result = await retireAndRedirectPost({
      slug: postSlug,
      destination: '/blog/destination-post',
      dryRun: true,
      postsDir,
      quarantineDir,
      keywordsDir,
      redirectsFile,
    });

    assert.equal(result.success, true);
    assert.equal(result.retired, false);
    // Source file must still exist
    assert.equal(existsSync(postPath), true);
    // Redirects file must still be empty
    assert.deepEqual(loadRedirects(redirectsFile), []);
  } finally {
    cleanupFixtures();
  }
});

test('retireAndRedirectPost: fails safely on missing source post or invalid destination', async () => {
  setupFixtures();
  try {
    const postsDir = join(FIXTURES_DIR, 'content', 'posts');
    const redirectsFile = join(FIXTURES_DIR, 'content', 'redirects.json');
    mkdirSync(postsDir, { recursive: true });
    saveRedirects([], redirectsFile);

    // Missing post file
    const missingResult = await retireAndRedirectPost({
      slug: 'non-existent-slug',
      destination: '/blog/dest',
      postsDir,
      redirectsFile,
    });
    assert.equal(missingResult.success, false);
    assert.match(missingResult.error || '', /Post file not found/);

    // Create a real post file to test loop/format errors
    const postSlug = 'test-error-post';
    writeFileSync(join(postsDir, `${postSlug}.mdx`), '---\n---\n', 'utf8');

    // Self-loop
    const loopResult = await retireAndRedirectPost({
      slug: postSlug,
      destination: `/blog/${postSlug}`,
      postsDir,
      redirectsFile,
    });
    assert.equal(loopResult.success, false);
    assert.match(loopResult.error || '', /Self-referential redirect loop/);

    // Missing leading slash on destination
    const badDestResult = await retireAndRedirectPost({
      slug: postSlug,
      destination: 'blog/invalid-dest',
      postsDir,
      redirectsFile,
    });
    assert.equal(badDestResult.success, false);
    assert.match(badDestResult.error || '', /Destination path must start with '\/'/);
  } finally {
    cleanupFixtures();
  }
});

