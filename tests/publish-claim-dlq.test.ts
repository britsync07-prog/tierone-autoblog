import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
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
} from '../lib/pipeline/registry';
import { readPipelineState, writePipelineState } from '../lib/pipeline/qa/circuit-breaker';
import type { RegistryEntry } from '../lib/pipeline/types';

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
    silo: 'ai-tools',
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
  assert.ok(Date.parse(published.publishedAt) > 0);

  // Missing draft.slug or qa.passedAt throws
  const invalidEntry: RegistryEntry = {
    id: 'test-kw-2',
    keyword: 'test keyword 2',
    silo: 'ai-tools',
    stage: 'drafted',
    createdAt: '2026-10-18T00:00:00.000Z',
    updatedAt: '2026-10-18T00:00:00.000Z',
  };

  assert.throws(() => {
    publishEntry(invalidEntry);
  }, /requires draft\.slug/);
});
