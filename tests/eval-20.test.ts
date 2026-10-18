import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  runEvalSuite,
  generateSyntheticDraft,
  type EvalQuery,
} from '../scripts/run-eval-suite';
import { SILO_SLUGS } from '../lib/silos';

test('Test 1: eval-queries.json contains exactly 20 queries across 5 silos (4 per silo)', () => {
  const fixturePath = resolve(process.cwd(), 'tests/fixtures/eval-queries.json');
  const raw = readFileSync(fixturePath, 'utf8');
  const queries: EvalQuery[] = JSON.parse(raw);

  assert.equal(queries.length, 20, 'Expected exactly 20 pinned queries');

  const counts: Record<string, number> = {};
  for (const q of queries) {
    counts[q.silo] = (counts[q.silo] ?? 0) + 1;
    assert.ok(q.id, 'Query must have id');
    assert.ok(q.query, 'Query must have query string');
    assert.ok(q.targetAudience, 'Query must have targetAudience');
    assert.ok(q.intent, 'Query must have intent');
    assert.ok(Array.isArray(q.expectedGainPoints), 'Query must have expectedGainPoints array');
  }

  assert.equal(Object.keys(counts).length, 5, 'Must cover all 5 evergreen silos');
  const evergreenSilos = SILO_SLUGS.filter((s) => s !== 'ai-news');
  for (const silo of evergreenSilos) {
    assert.equal(counts[silo], 4, `Expected exactly 4 queries for silo ${silo}, got ${counts[silo]}`);
  }
});

test('Test 2: runEvalSuite() executes fast (< 5000ms offline)', async () => {
  const start = Date.now();
  const summary = await runEvalSuite({ verbose: false });
  const elapsed = Date.now() - start;

  assert.ok(elapsed < 5000, `Expected runEvalSuite to complete in < 5000ms, took ${elapsed}ms`);
  assert.ok(summary.durationMs < 5000, `Expected summary.durationMs < 5000ms, got ${summary.durationMs}ms`);
});

test('Test 3: summary.passedCount === 20 (100% structural and safety pass rate)', async () => {
  const summary = await runEvalSuite({ verbose: false });

  assert.equal(summary.totalQueries, 20);
  assert.equal(summary.passedCount, 20, `Expected 20/20 passed, got ${summary.passedCount}`);
  assert.equal(summary.failedCount, 0, `Expected 0 failed, got ${summary.failedCount}`);

  for (const r of summary.results) {
    assert.equal(r.schemaValid, true, `Query ${r.id} schema must be valid`);
    assert.equal(r.titleValid, true, `Query ${r.id} title length (${r.titleLength}) must be 50-60`);
    assert.equal(r.descValid, true, `Query ${r.id} desc length (${r.descLength}) must be 150-160`);
    assert.equal(r.bylineValid, true, `Query ${r.id} byline must be valid`);
    assert.equal(r.blocklistPassed, true, `Query ${r.id} must be blocklist safe`);
    assert.equal(r.infoGainPassed, true, `Query ${r.id} must pass info gain rubric`);
    assert.equal(r.passedAll, true, `Query ${r.id} must pass all checks`);
  }
});

test('Test 4: summary.meanInfoGain >= 3.0 (Information Gain threshold satisfied)', async () => {
  const summary = await runEvalSuite({ verbose: false });

  assert.ok(
    summary.meanInfoGain >= 3.0,
    `Expected mean Information Gain >= 3.0, got ${summary.meanInfoGain}`,
  );
  assert.ok(summary.meanInfoGain <= 4.0, `Mean Information Gain cannot exceed 4.0`);
});

test('Test 5: summary.passedGate === true for baseline compliant suite', async () => {
  const summary = await runEvalSuite({ verbose: false });

  assert.equal(
    summary.passedGate,
    true,
    'Expected passedGate to be true when all 20 queries pass and mean >= 3.0',
  );
});

test('Test 6: Artificially degraded test: dropping comparison tables and edge cases drops score below 3.0 and fails the gate', async () => {
  // Degraded synthesizer: strips comparison tables and edge cases from markdown body
  const degradedSynthesizer = (query: EvalQuery) => {
    const base = generateSyntheticDraft(query);
    // Remove comparison tables and edge cases/limitations section
    const degradedBody = `
## Overview and Basic Info
Here is how to get started:
Step 1: Simple install steps.
Step 2: Basic run command.

## Summary Notes
This is generic information with only high-level notes and no deep analysis.

## Frequently Asked Questions
- Q: What are the best alternatives to this approach?
  A: Depending on your workflow needs, several open-source and proprietary tools offer strong alternatives.

## Author Details
Written by [Musfiqur Rahman Saimon](/about).
Read our [editorial process](/editorial-process).
`;

    return {
      frontmatter: base.frontmatter,
      body: degradedBody,
      rawMdx: base.rawMdx.split('---')[0] + '---\n' + base.rawMdx.split('---')[1] + '---\n' + degradedBody,
    };
  };

  const degradedSummary = await runEvalSuite({
    verbose: false,
    synthesizer: degradedSynthesizer,
  });

  // Score should drop to 2/4 (workflow=1, gapClosure=1, comparison=0, edgeCases=0)
  assert.ok(
    degradedSummary.meanInfoGain < 3.0,
    `Expected degraded score < 3.0, got ${degradedSummary.meanInfoGain}`,
  );
  assert.equal(
    degradedSummary.passedGate,
    false,
    'Expected degraded suite to fail CI regression gate',
  );
  assert.equal(degradedSummary.passedCount, 0, 'No queries should pass infoGain rubric with score < 3');
});
