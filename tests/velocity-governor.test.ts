import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  checkVelocityGovernor,
  isBaselineDay,
  type GovernorCheckOptions,
} from '../lib/pipeline/publish/governor';
import { runPublishScheduled } from '../scripts/publish-scheduled';
import { writePipelineState } from '../lib/pipeline/qa/circuit-breaker';
import { saveShard } from '../lib/pipeline/registry';
import { SILO_SLUGS } from '../lib/silos';
import type { RegistryEntry, RegistryShard } from '../lib/pipeline/types';

function createMockShard(silo: string, entries: Partial<RegistryEntry>[]): RegistryShard {
  return {
    version: 1,
    silo: silo as any,
    updatedAt: new Date().toISOString(),
    keywords: entries.map((e, idx) => ({
      id: e.id ?? `test-${silo}-${idx + 1}`,
      keyword: e.keyword ?? `test keyword ${idx + 1}`,
      silo: silo as any,
      stage: e.stage ?? 'published',
      createdAt: e.createdAt ?? new Date('2026-06-01T00:00:00Z').toISOString(),
      publishedAt: e.publishedAt,
      updatedAt: e.updatedAt ?? new Date().toISOString(),
      brief: e.brief ?? { completedAt: new Date('2026-06-01T00:00:00Z').toISOString() },
      outline: e.outline ?? { completedAt: new Date('2026-06-01T00:00:00Z').toISOString(), lint: 'pass' },
      qa: e.qa ?? { passedAt: e.publishedAt ?? new Date().toISOString(), score: 95 },
      draft: e.draft ?? {
        slug: `test-post-${idx + 1}`,
        title: `Test Post ${idx + 1}`,
        targetWordCount: 1500,
        completedAt: new Date().toISOString(),
      },
      ...e,
    })) as RegistryEntry[],
  };
}

test('velocity governor: Criterion 1 - domain age < 60 days locks governor', () => {
  const tmpDir = join(process.cwd(), 'tmp-test-gov-age');
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });

  const now = new Date('2026-10-18T12:00:00Z');
  // 30 days ago
  const publishedAt = new Date('2026-09-18T12:00:00Z').toISOString();

  // 12 published posts, all 30 days old
  const entries: Partial<RegistryEntry>[] = Array.from({ length: 12 }, (_, i) => ({
    id: `post-${i + 1}`,
    stage: 'published',
    publishedAt,
  }));

  saveShard(tmpDir, SILO_SLUGS[0], createMockShard(SILO_SLUGS[0], entries));
  writePipelineState({ paused: false, consecutiveFailures: 0, failureHistory: [] }, tmpDir);

  const evaluation = checkVelocityGovernor({
    keywordsDir: tmpDir,
    now,
    mockIndexRatio: 0.85,
  });

  assert.equal(evaluation.unlocked, false);
  assert.equal(evaluation.domainAgePassed, false);
  assert.equal(evaluation.domainAgeDays, 30);
  assert.equal(evaluation.indexationPassed, true);
  assert.equal(evaluation.stabilityPassed, true);
  assert.equal(evaluation.corpusPassed, true);
  assert.match(evaluation.reasons[0], /Domain operating age 30d < 60d/);

  rmSync(tmpDir, { recursive: true, force: true });
});

test('velocity governor: Criterion 2 - indexation ratio < 0.70 locks governor', () => {
  const tmpDir = join(process.cwd(), 'tmp-test-gov-index');
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });

  const now = new Date('2026-10-18T12:00:00Z');
  // 70 days ago
  const publishedAt = new Date('2026-08-05T12:00:00Z').toISOString();

  const entries: Partial<RegistryEntry>[] = Array.from({ length: 10 }, (_, i) => ({
    id: `post-${i + 1}`,
    stage: 'published',
    publishedAt,
  }));

  saveShard(tmpDir, SILO_SLUGS[0], createMockShard(SILO_SLUGS[0], entries));
  writePipelineState({ paused: false, consecutiveFailures: 0, failureHistory: [] }, tmpDir);

  const evaluation = checkVelocityGovernor({
    keywordsDir: tmpDir,
    now,
    mockIndexRatio: 0.65,
  });

  assert.equal(evaluation.unlocked, false);
  assert.equal(evaluation.domainAgePassed, true);
  assert.equal(evaluation.indexationPassed, false);
  assert.equal(evaluation.indexationRatio, 0.65);
  assert.match(evaluation.reasons[0], /GSC indexation ratio 65.0% < 70%/);

  rmSync(tmpDir, { recursive: true, force: true });
});

test('velocity governor: Criterion 3 - paused circuit breaker or recent failures lock governor', () => {
  const tmpDir = join(process.cwd(), 'tmp-test-gov-cb');
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });

  const now = new Date('2026-10-18T12:00:00Z');
  const publishedAt = new Date('2026-08-01T12:00:00Z').toISOString();

  const entries: Partial<RegistryEntry>[] = Array.from({ length: 10 }, (_, i) => ({
    id: `post-${i + 1}`,
    stage: 'published',
    publishedAt,
  }));

  saveShard(tmpDir, SILO_SLUGS[0], createMockShard(SILO_SLUGS[0], entries));

  // Case 3a: Paused circuit breaker
  writePipelineState(
    {
      paused: true,
      consecutiveFailures: 3,
      failureHistory: [],
      reason: 'Tripped consecutive failures',
    },
    tmpDir
  );

  const evalPaused = checkVelocityGovernor({
    keywordsDir: tmpDir,
    now,
    mockIndexRatio: 0.85,
  });

  assert.equal(evalPaused.unlocked, false);
  assert.equal(evalPaused.stabilityPassed, false);
  assert.match(evalPaused.reasons[0], /Circuit breaker is currently paused/);

  // Case 3b: Unpaused, but failure occurred 10 days ago (<30 days lookback)
  writePipelineState(
    {
      paused: false,
      consecutiveFailures: 0,
      failureHistory: [
        {
          id: 'test-fail-1',
          failedRule: 'thin-content',
          timestamp: new Date('2026-10-08T12:00:00Z').toISOString(),
        },
      ],
    },
    tmpDir
  );

  const evalRecentFailure = checkVelocityGovernor({
    keywordsDir: tmpDir,
    now,
    mockIndexRatio: 0.85,
  });

  assert.equal(evalRecentFailure.unlocked, false);
  assert.equal(evalRecentFailure.stabilityPassed, false);
  assert.equal(evalRecentFailure.circuitBreakerTrips30d, 1);
  assert.match(evalRecentFailure.reasons[0], /recorded 1 failure\(s\) in the last 30 days/);

  // Case 3c: Failure was 45 days ago (> 30 days lookback) -> should pass stability
  writePipelineState(
    {
      paused: false,
      consecutiveFailures: 0,
      failureHistory: [
        {
          id: 'test-fail-old',
          failedRule: 'thin-content',
          timestamp: new Date('2026-08-20T12:00:00Z').toISOString(),
        },
      ],
    },
    tmpDir
  );

  const evalOldFailure = checkVelocityGovernor({
    keywordsDir: tmpDir,
    now,
    mockIndexRatio: 0.85,
  });

  assert.equal(evalOldFailure.stabilityPassed, true);
  assert.equal(evalOldFailure.circuitBreakerTrips30d, 0);

  rmSync(tmpDir, { recursive: true, force: true });
});

test('velocity governor: Criterion 4 - active corpus < 10 locks governor', () => {
  const tmpDir = join(process.cwd(), 'tmp-test-gov-corpus');
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });

  const now = new Date('2026-10-18T12:00:00Z');
  const publishedAt = new Date('2026-07-01T12:00:00Z').toISOString();

  // Only 6 published posts
  const entries: Partial<RegistryEntry>[] = Array.from({ length: 6 }, (_, i) => ({
    id: `post-${i + 1}`,
    stage: 'published',
    publishedAt,
  }));

  saveShard(tmpDir, SILO_SLUGS[0], createMockShard(SILO_SLUGS[0], entries));
  writePipelineState({ paused: false, consecutiveFailures: 0, failureHistory: [] }, tmpDir);

  const evaluation = checkVelocityGovernor({
    keywordsDir: tmpDir,
    now,
    mockIndexRatio: 0.85,
  });

  assert.equal(evaluation.unlocked, false);
  assert.equal(evaluation.activeCorpusCount, 6);
  assert.equal(evaluation.corpusPassed, false);
  assert.match(evaluation.reasons[0], /Active corpus size 6 < 10/);

  rmSync(tmpDir, { recursive: true, force: true });
});

test('velocity governor: All 4 criteria passing unlocks governor', () => {
  const tmpDir = join(process.cwd(), 'tmp-test-gov-pass');
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });

  const now = new Date('2026-10-18T12:00:00Z');
  const publishedAt = new Date('2026-08-01T12:00:00Z').toISOString(); // 78 days ago

  const entries: Partial<RegistryEntry>[] = Array.from({ length: 12 }, (_, i) => ({
    id: `post-${i + 1}`,
    stage: 'published',
    publishedAt,
  }));

  saveShard(tmpDir, SILO_SLUGS[0], createMockShard(SILO_SLUGS[0], entries));
  writePipelineState({ paused: false, consecutiveFailures: 0, failureHistory: [] }, tmpDir);

  const evaluation = checkVelocityGovernor({
    keywordsDir: tmpDir,
    now,
    mockIndexRatio: 0.78,
  });

  assert.equal(evaluation.unlocked, true);
  assert.equal(evaluation.domainAgePassed, true);
  assert.equal(evaluation.indexationPassed, true);
  assert.equal(evaluation.stabilityPassed, true);
  assert.equal(evaluation.corpusPassed, true);
  assert.equal(evaluation.reasons.length, 0);

  rmSync(tmpDir, { recursive: true, force: true });
});

test('velocity governor: Day gating and scheduled publisher integration', async () => {
  const tmpDir = join(process.cwd(), 'tmp-test-gov-sched');
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });

  // Baseline days: Sun (0), Mon (1), Wed (3), Fri (5)
  assert.equal(isBaselineDay(new Date('2026-10-18T12:00:00Z')), true); // Sunday
  assert.equal(isBaselineDay(new Date('2026-10-19T12:00:00Z')), true); // Monday
  assert.equal(isBaselineDay(new Date('2026-10-21T12:00:00Z')), true); // Wednesday
  assert.equal(isBaselineDay(new Date('2026-10-23T12:00:00Z')), true); // Friday

  // Expanded days: Tue (2), Thu (4), Sat (6)
  assert.equal(isBaselineDay(new Date('2026-10-20T12:00:00Z')), false); // Tuesday
  assert.equal(isBaselineDay(new Date('2026-10-22T12:00:00Z')), false); // Thursday
  assert.equal(isBaselineDay(new Date('2026-10-24T12:00:00Z')), false); // Saturday

  // Setup locked registry (<60 days)
  const tuesdayDate = new Date('2026-10-20T12:00:00Z');
  const youngPublishedAt = new Date('2026-10-01T12:00:00Z').toISOString(); // 19 days old

  const entries: Partial<RegistryEntry>[] = [
    {
      id: 'draft-candidate-1',
      stage: 'drafted',
      qa: { passedAt: new Date('2026-10-10T12:00:00Z').toISOString(), score: 95 },
      draft: { slug: 'new-draft', title: 'New Draft', targetWordCount: 1500, completedAt: '' },
    },
    {
      id: 'published-1',
      stage: 'published',
      publishedAt: youngPublishedAt,
    },
  ];

  saveShard(tmpDir, SILO_SLUGS[0], createMockShard(SILO_SLUGS[0], entries));
  writePipelineState({ paused: false, consecutiveFailures: 0, failureHistory: [] }, tmpDir);

  // 1. On Tuesday (expanded day) with locked governor: skips cleanly
  const resTuesdayLocked = await runPublishScheduled({
    keywordsDir: tmpDir,
    now: tuesdayDate,
    mockIndexRatio: 0.8,
  });

  assert.equal(resTuesdayLocked.status, 'skipped');
  assert.match(resTuesdayLocked.reason ?? '', /Velocity governor locked/);

  // 2. On Monday (baseline day) with locked governor: does NOT skip on governor, proceeds to dry-run/find candidate
  const mondayDate = new Date('2026-10-19T12:00:00Z');
  const resMonday = await runPublishScheduled({
    keywordsDir: tmpDir,
    now: mondayDate,
    dryRun: true,
  });

  assert.equal(resMonday.status, 'dry-run');
  assert.equal(resMonday.candidateId, 'draft-candidate-1');

  // 3. On Tuesday with UNLOCKED governor: proceeds to publish / dry-run
  // Make 10 published posts 70 days old
  const maturePublishedAt = new Date('2026-08-01T12:00:00Z').toISOString();
  const unlockedEntries: Partial<RegistryEntry>[] = [
    {
      id: 'draft-candidate-1',
      stage: 'drafted',
      qa: { passedAt: new Date('2026-10-10T12:00:00Z').toISOString(), score: 95 },
      draft: { slug: 'new-draft', title: 'New Draft', targetWordCount: 1500, completedAt: '' },
    },
    ...Array.from({ length: 10 }, (_, i) => ({
      id: `published-${i + 1}`,
      stage: 'published' as const,
      publishedAt: maturePublishedAt,
    })),
  ];

  saveShard(tmpDir, SILO_SLUGS[0], createMockShard(SILO_SLUGS[0], unlockedEntries));

  const resTuesdayUnlocked = await runPublishScheduled({
    keywordsDir: tmpDir,
    now: tuesdayDate,
    mockIndexRatio: 0.8,
    dryRun: true,
  });

  assert.equal(resTuesdayUnlocked.status, 'dry-run');
  assert.equal(resTuesdayUnlocked.candidateId, 'draft-candidate-1');

  rmSync(tmpDir, { recursive: true, force: true });
});
