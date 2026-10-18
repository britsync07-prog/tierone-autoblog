import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  readPipelineState,
  recordQaFailure,
  recordQaSuccess,
  resetCircuitBreaker,
} from '../lib/pipeline/qa/circuit-breaker';

test('circuit-breaker tracks failures, trips at K=3, generates ALERT.md, and resets on resume', () => {
  const tmpDir = join(process.cwd(), 'tmp-test-circuit-breaker');
  const keywordsDir = join(tmpDir, 'keywords');
  const quarantineDir = join(tmpDir, 'quarantine');

  mkdirSync(keywordsDir, { recursive: true });
  mkdirSync(quarantineDir, { recursive: true });

  // Initial state is unpaused
  const state0 = readPipelineState(keywordsDir);
  assert.equal(state0.paused, false);
  assert.equal(state0.consecutiveFailures, 0);

  // Failure 1: consecutiveFailures = 1, paused = false
  const tripped1 = recordQaFailure(
    { id: 'draft-01', failedRule: 'blocklist' },
    { keywordsDir, quarantineDir, maxConsecutive: 3 },
  );
  assert.equal(tripped1, false);
  const state1 = readPipelineState(keywordsDir);
  assert.equal(state1.consecutiveFailures, 1);
  assert.equal(state1.paused, false);

  // Success resets consecutiveFailures to 0
  recordQaSuccess(keywordsDir);
  const stateSuccess = readPipelineState(keywordsDir);
  assert.equal(stateSuccess.consecutiveFailures, 0);

  // Failure 1 again
  recordQaFailure(
    { id: 'draft-02', failedRule: 'link-crawler' },
    { keywordsDir, quarantineDir, maxConsecutive: 3 },
  );
  // Failure 2
  recordQaFailure(
    { id: 'draft-03', failedRule: 'originality' },
    { keywordsDir, quarantineDir, maxConsecutive: 3 },
  );
  const state2 = readPipelineState(keywordsDir);
  assert.equal(state2.consecutiveFailures, 2);
  assert.equal(state2.paused, false);

  // Failure 3: trips circuit breaker
  const tripped3 = recordQaFailure(
    { id: 'draft-04', failedRule: 'fact-check' },
    { keywordsDir, quarantineDir, maxConsecutive: 3 },
  );
  assert.equal(tripped3, true);

  const state3 = readPipelineState(keywordsDir);
  assert.equal(state3.consecutiveFailures, 3);
  assert.equal(state3.paused, true);
  assert.ok(state3.pausedAt);

  // ALERT.md generated
  const alertFile = join(quarantineDir, 'ALERT.md');
  assert.equal(existsSync(alertFile), true, 'ALERT.md must exist in quarantine dir');
  const alertText = readFileSync(alertFile, 'utf8');
  assert.match(alertText, /CIRCUIT BREAKER TRIPPED/);
  assert.match(alertText, /draft-04/);
  assert.match(alertText, /fact-check/);
  assert.match(alertText, /npm run pipeline:resume/);

  // Reset circuit breaker
  const resumed = resetCircuitBreaker(keywordsDir, quarantineDir);
  assert.equal(resumed.paused, false);
  assert.equal(resumed.consecutiveFailures, 0);
  assert.equal(existsSync(alertFile), false, 'ALERT.md must be removed after resume');

  // Cleanup
  rmSync(tmpDir, { recursive: true, force: true });
});
