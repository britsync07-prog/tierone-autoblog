import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  computeClaimHash,
  acquireClaimLock,
  releaseClaimLock,
  isClaimActive,
  CLAIM_LOCK_TTL_MS,
} from '../lib/pipeline/publish/claim-lock';
import {
  assertTransitionStage,
  publishEntry,
  loadShard,
  saveShard,
} from '../lib/pipeline/registry';
import {
  recordDlqFailure,
  getDlqEntry,
  clearDlqEntry,
  checkDlqExhaustion,
  readDlq,
} from '../lib/pipeline/publish/dlq';
import {
  findPublishableCandidates,
  runPublishScheduled,
} from '../scripts/publish-scheduled';
import { readPipelineState, writePipelineState } from '../lib/pipeline/qa/circuit-breaker';
import type { RegistryEntry, RegistryShard } from '../lib/pipeline/types';

const TMP_TEST_DIR = join(process.cwd(), 'tmp-test-publish-claim');

function cleanup() {
  if (existsSync(TMP_TEST_DIR)) {
    rmSync(TMP_TEST_DIR, { recursive: true, force: true });
  }
}

test('computeClaimHash generates deterministic sha256 fingerprint', () => {
  const hash1 = computeClaimHash('kw-ai-tools', '2026-10-18T10:00:00.000Z');
  const hash2 = computeClaimHash('kw-ai-tools', '2026-10-18T10:00:00.000Z');
  const hash3 = computeClaimHash('kw-ai-tools-2', '2026-10-18T10:00:00.000Z');

  assert.equal(typeof hash1, 'string');
  assert.equal(hash1.length, 64);
  assert.equal(hash1, hash2);
  assert.notEqual(hash1, hash3);
});

test('acquireClaimLock acquires lock and rejects concurrent claims', () => {
  cleanup();
  const keywordsDir = join(TMP_TEST_DIR, 'keywords');
  mkdirSync(keywordsDir, { recursive: true });

  assert.equal(isClaimActive(keywordsDir), false);

  const res1 = acquireClaimLock('kw-1', '2026-10-18T10:00:00.000Z', keywordsDir);
  assert.equal(res1.success, true);
  assert.equal(typeof res1.hash, 'string');
  assert.equal(isClaimActive(keywordsDir), true);

  // Second claim attempt while lock is fresh (<30m) must fail
  const res2 = acquireClaimLock('kw-2', '2026-10-18T10:05:00.000Z', keywordsDir);
  assert.equal(res2.success, false);
  assert.equal(res2.hash, res1.hash);
  assert.match(res2.reason ?? '', /Already claimed by entry kw-1/);

  // Even identical candidate re-claim is rejected while active
  const res3 = acquireClaimLock('kw-1', '2026-10-18T10:00:00.000Z', keywordsDir);
  assert.equal(res3.success, false);

  // Release with wrong hash does not release
  releaseClaimLock('wrong-hash', keywordsDir);
  assert.equal(isClaimActive(keywordsDir), true);

  // Release with correct hash clears lock
  releaseClaimLock(res1.hash, keywordsDir);
  assert.equal(isClaimActive(keywordsDir), false);

  // Re-acquire now succeeds
  const res4 = acquireClaimLock('kw-2', '2026-10-18T10:05:00.000Z', keywordsDir);
  assert.equal(res4.success, true);

  cleanup();
});

test('acquireClaimLock overrides stale lock older than 30 minutes', () => {
  cleanup();
  const keywordsDir = join(TMP_TEST_DIR, 'keywords');
  mkdirSync(keywordsDir, { recursive: true });

  // Manually seed a stale lock (>30m ago)
  const staleTime = new Date(Date.now() - (CLAIM_LOCK_TTL_MS + 60000)).toISOString();
  const state = readPipelineState(keywordsDir);
  state.activeClaim = {
    hash: 'stale-hash',
    entryId: 'kw-stale',
    claimedAt: staleTime,
  };
  writePipelineState(state, keywordsDir);

  assert.equal(isClaimActive(keywordsDir), false);

  // Acquire should override stale lock
  const res = acquireClaimLock('kw-fresh', '2026-10-18T11:00:00.000Z', keywordsDir);
  assert.equal(res.success, true);

  const updatedState = readPipelineState(keywordsDir);
  assert.equal(updatedState.activeClaim?.entryId, 'kw-fresh');
  assert.equal(updatedState.activeClaim?.hash, res.hash);

  cleanup();
});

test('assertTransitionStage permits drafted -> published and quarantined -> published', () => {
  assert.doesNotThrow(() => {
    assertTransitionStage('drafted', 'published');
  });

  assert.doesNotThrow(() => {
    assertTransitionStage('quarantined', 'published');
  });

  assert.throws(() => {
    assertTransitionStage('expanded', 'published');
  }, /invalid stage transition 'expanded' -> 'published'/);

  assert.throws(() => {
    assertTransitionStage('outlined', 'published');
  }, /invalid stage transition 'outlined' -> 'published'/);
});

test('publishEntry advances drafted entry to published stage with timestamps and validation', () => {
  const validEntry: RegistryEntry = {
    id: 'test-kw',
    keyword: 'test keyword',
    silo: 'ai-coding',
    stage: 'drafted',
    createdAt: '2026-10-18T00:00:00.000Z',
    updatedAt: '2026-10-18T00:00:00.000Z',
    draft: {
      slug: 'test-keyword-guide',
      attempts: 1,
    },
    qa: {
      passedAt: '2026-10-18T01:00:00.000Z',
    },
  };

  const published = publishEntry(validEntry);
  assert.equal(published.stage, 'published');
  assert.equal(typeof published.publishedAt, 'string');
  assert.ok(Date.parse(published.publishedAt!) > 0);

  // Missing draft.slug or qa.passedAt throws
  const invalidEntry: RegistryEntry = {
    id: 'test-kw-2',
    keyword: 'test keyword 2',
    silo: 'ai-coding',
    stage: 'drafted',
    createdAt: '2026-10-18T00:00:00.000Z',
    updatedAt: '2026-10-18T00:00:00.000Z',
  };

  assert.throws(() => {
    publishEntry(invalidEntry);
  }, /requires draft\.slug/);
});

test('DLQ tracks transient failures and clears upon successful publish', () => {
  cleanup();
  const keywordsDir = join(TMP_TEST_DIR, 'keywords');
  mkdirSync(keywordsDir, { recursive: true });

  assert.equal(checkDlqExhaustion('kw-fail', keywordsDir), false);

  // Attempt 1: recorded in dlq.json, exhausted = false
  const r1 = recordDlqFailure('kw-fail', 'ai-coding', 'Network timeout', keywordsDir);
  assert.equal(r1.exhausted, false);
  assert.equal(r1.attempts, 1);

  const entry1 = getDlqEntry('kw-fail', keywordsDir);
  assert.ok(entry1);
  assert.equal(entry1.attempts, 1);
  assert.equal(entry1.lastError, 'Network timeout');

  // Attempt 2: incremented, exhausted = false
  const r2 = recordDlqFailure('kw-fail', 'ai-coding', 'Vercel deploy failed', keywordsDir);
  assert.equal(r2.exhausted, false);
  assert.equal(r2.attempts, 2);
  assert.equal(checkDlqExhaustion('kw-fail', keywordsDir), false);

  // Clear DLQ entry on success
  clearDlqEntry('kw-fail', keywordsDir);
  assert.equal(getDlqEntry('kw-fail', keywordsDir), undefined);
  const dlqState = readDlq(keywordsDir);
  assert.equal(dlqState.entries.length, 0);

  cleanup();
});

function createDraftedEntry(
  id: string,
  slug: string,
  passedAt?: string,
): RegistryEntry {
  return {
    id,
    keyword: `${id} keyword`,
    silo: 'ai-coding',
    stage: 'drafted',
    createdAt: '2026-10-18T00:00:00.000Z',
    updatedAt: '2026-10-18T00:00:00.000Z',
    brief: { completedAt: '2026-10-18T00:00:00.000Z' },
    outline: { completedAt: '2026-10-18T00:00:00.000Z', lint: 'pass' },
    draft: { slug, attempts: 1 },
    qa: passedAt ? { passedAt } : undefined,
  };
}

test('DLQ 3-strike rule escalates to quarantine and alerts', () => {
  cleanup();
  const keywordsDir = join(TMP_TEST_DIR, 'keywords');
  const quarantineDir = join(TMP_TEST_DIR, 'quarantine');
  const postsDir = join(TMP_TEST_DIR, 'posts');

  mkdirSync(join(keywordsDir, 'ai-coding'), { recursive: true });
  mkdirSync(quarantineDir, { recursive: true });
  mkdirSync(postsDir, { recursive: true });

  const slug = 'test-strike-slug';
  const postPath = join(postsDir, `${slug}.mdx`);
  writeFileSync(postPath, '# Dummy draft content', 'utf8');

  // Seed shard with a drafted entry
  const entry = createDraftedEntry('test-strike-kw', slug, '2026-10-18T01:00:00.000Z');

  const initialShard: RegistryShard = {
    version: 1,
    updatedAt: '2026-10-18T00:00:00.000Z',
    keywords: [entry],
  };
  saveShard(keywordsDir, 'ai-coding', initialShard);

  const options = { keywordsDir, quarantineDir, postsDir };

  // Strike 1 & 2
  recordDlqFailure('test-strike-kw', 'ai-coding', 'Error 1', options);
  recordDlqFailure('test-strike-kw', 'ai-coding', 'Error 2', options);
  assert.equal(checkDlqExhaustion('test-strike-kw', keywordsDir), false);

  // Strike 3: Escalation
  const r3 = recordDlqFailure('test-strike-kw', 'ai-coding', 'Error 3 fatal', options);
  assert.equal(r3.exhausted, true);
  assert.equal(r3.attempts, 3);
  assert.equal(checkDlqExhaustion('test-strike-kw', keywordsDir), true);

  // Verify post moved out of postsDir into quarantineDir
  assert.equal(existsSync(postPath), false);
  const quarantinedPost = join(quarantineDir, 'test-strike-kw.mdx');
  assert.equal(existsSync(quarantinedPost), true);

  // Verify audit report created
  const reportPath = join(quarantineDir, 'test-strike-kw-report.json');
  assert.equal(existsSync(reportPath), true);
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  assert.equal(report.failedGate, 'publish_dlq_exhausted');
  assert.equal(report.score, 3);

  // Verify ALERT.md updated
  const alertPath = join(quarantineDir, 'ALERT.md');
  assert.equal(existsSync(alertPath), true);
  const alertContent = readFileSync(alertPath, 'utf8');
  assert.match(alertContent, /test-strike-kw/);
  assert.match(alertContent, /DLQ Exhausted Alert/);

  // Verify registry entry transitioned to 'quarantined'
  const updatedShard = loadShard(keywordsDir, 'ai-coding');
  const updatedEntry = updatedShard.keywords.find((k) => k.id === 'test-strike-kw');
  assert.equal(updatedEntry?.stage, 'quarantined');
  assert.equal(updatedEntry?.quarantine?.failedRule, 'publish_dlq_exhausted');

  cleanup();
});

test('findPublishableCandidates selects FIFO by qa.passedAt and ignores DLQ-exhausted', () => {
  cleanup();
  const keywordsDir = join(TMP_TEST_DIR, 'keywords');
  const siloDir = join(keywordsDir, 'ai-coding');
  mkdirSync(siloDir, { recursive: true });

  const c1 = createDraftedEntry('kw-fifo-older', 'older-slug', '2026-10-18T01:00:00.000Z');
  const c2 = createDraftedEntry('kw-fifo-newer', 'newer-slug', '2026-10-18T02:00:00.000Z');
  const c3 = createDraftedEntry('kw-fifo-exhausted', 'exhausted-slug', '2026-10-18T00:30:00.000Z');
  const c4 = createDraftedEntry('kw-fifo-unpassed', 'unpassed-slug');

  const shard: RegistryShard = {
    version: 1,
    updatedAt: '2026-10-18T00:00:00.000Z',
    keywords: [c2, c1, c3, c4],
  };
  const quarantineDir = join(TMP_TEST_DIR, 'quarantine');
  const postsDir = join(TMP_TEST_DIR, 'posts');
  mkdirSync(quarantineDir, { recursive: true });
  mkdirSync(postsDir, { recursive: true });
  saveShard(keywordsDir, 'ai-coding', shard);

  // Exhaust c3 in DLQ
  const dlqOpts = { keywordsDir, quarantineDir, postsDir };
  recordDlqFailure('kw-fifo-exhausted', 'ai-coding', 'err1', dlqOpts);
  recordDlqFailure('kw-fifo-exhausted', 'ai-coding', 'err2', dlqOpts);
  recordDlqFailure('kw-fifo-exhausted', 'ai-coding', 'err3', dlqOpts);

  const candidates = findPublishableCandidates(keywordsDir);
  assert.equal(candidates.length, 2);
  // FIFO order: c1 (01:00) before c2 (02:00)
  assert.equal(candidates[0].id, 'kw-fifo-older');
  assert.equal(candidates[1].id, 'kw-fifo-newer');

  cleanup();
});

test('runPublishScheduled publishes candidate, dispatches indexing, and releases lock', async () => {
  cleanup();
  const keywordsDir = join(TMP_TEST_DIR, 'keywords');
  const quarantineDir = join(TMP_TEST_DIR, 'quarantine');
  const postsDir = join(TMP_TEST_DIR, 'posts');

  mkdirSync(join(keywordsDir, 'ai-coding'), { recursive: true });
  mkdirSync(quarantineDir, { recursive: true });
  mkdirSync(postsDir, { recursive: true });

  const entry = createDraftedEntry('kw-pub-test', 'auto-publish-slug', '2026-10-18T01:00:00.000Z');

  const shard: RegistryShard = {
    version: 1,
    updatedAt: '2026-10-18T00:00:00.000Z',
    keywords: [entry],
  };
  saveShard(keywordsDir, 'ai-coding', shard);

  const baseDate = new Date('2026-10-18T10:00:00.000Z');

  // Dry run first
  const dryResult = await runPublishScheduled({
    keywordsDir,
    quarantineDir,
    postsDir,
    dryRun: true,
    now: baseDate,
  });
  assert.equal(dryResult.status, 'dry-run');
  assert.equal(isClaimActive(keywordsDir), false);

  // Verify shard still drafted
  const shardAfterDry = loadShard(keywordsDir, 'ai-coding');
  assert.equal(shardAfterDry.keywords[0].stage, 'drafted');

  // Actual publish
  const pubResult = await runPublishScheduled({
    keywordsDir,
    quarantineDir,
    postsDir,
    siteUrl: 'https://exclusivesources.online',
    now: baseDate,
  });
  assert.equal(pubResult.status, 'published');
  assert.equal(pubResult.candidateId, 'kw-pub-test');
  assert.equal(pubResult.slug, 'auto-publish-slug');
  assert.equal(isClaimActive(keywordsDir), false);

  // Verify shard updated to 'published'
  const shardAfterPub = loadShard(keywordsDir, 'ai-coding');
  assert.equal(shardAfterPub.keywords[0].stage, 'published');
  assert.ok(shardAfterPub.keywords[0].publishedAt);

  // Running again now finds no candidates waiting
  const emptyResult = await runPublishScheduled({
    keywordsDir,
    quarantineDir,
    postsDir,
    now: baseDate,
  });
  assert.equal(emptyResult.status, 'skipped');

  cleanup();
});

test('runPublishScheduled respects active claim lock and aborts concurrent execution', async () => {
  cleanup();
  const keywordsDir = join(TMP_TEST_DIR, 'keywords');
  mkdirSync(join(keywordsDir, 'ai-coding'), { recursive: true });

  const entry = createDraftedEntry('kw-locked-test', 'locked-slug', '2026-10-18T01:00:00.000Z');

  const shard: RegistryShard = {
    version: 1,
    updatedAt: '2026-10-18T00:00:00.000Z',
    keywords: [entry],
  };
  saveShard(keywordsDir, 'ai-coding', shard);

  // Pre-acquire lock to simulate parallel worker
  const lock = acquireClaimLock('other-worker', '2026-10-18T00:00:00.000Z', keywordsDir);
  assert.equal(lock.success, true);

  const lockedResult = await runPublishScheduled({
    keywordsDir,
    now: new Date('2026-10-18T10:00:00.000Z'),
  });
  assert.equal(lockedResult.status, 'locked');

  releaseClaimLock(lock.hash, keywordsDir);
  cleanup();
});
