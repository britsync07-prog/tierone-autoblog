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
