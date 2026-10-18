// CLI resume tool for pipeline auto-pause (D-11).
// Zero-dependencies: directly resets content/keywords/pipeline-state.json
// and removes content/quarantine/ALERT.md.
// Run: npm run pipeline:resume
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const statePath = join(ROOT, 'content', 'keywords', 'pipeline-state.json');
const alertPath = join(ROOT, 'content', 'quarantine', 'ALERT.md');

let state = { paused: false, consecutiveFailures: 0, failureHistory: [] };
if (existsSync(statePath)) {
  try {
    state = JSON.parse(readFileSync(statePath, 'utf8'));
  } catch {
    // Ignore parse error and overwrite
  }
}

state.paused = false;
state.consecutiveFailures = 0;
state.reason = undefined;

writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');

if (existsSync(alertPath)) {
  try {
    unlinkSync(alertPath);
  } catch {
    // Ignore unlink error
  }
}

console.log('\n==================================================');
console.log('  PIPELINE CIRCUIT BREAKER RESET');
console.log('==================================================');
console.log('Status:               ACTIVE / UNPAUSED');
console.log('Consecutive Failures: 0');
console.log('content/quarantine/ALERT.md cleared.');
console.log('\nPipeline is ready to resume runs:\n  npm run pipeline\n');
