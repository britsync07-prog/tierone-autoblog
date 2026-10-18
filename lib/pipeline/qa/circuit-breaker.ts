// Pipeline circuit-breaker & multi-channel alerting (D-10/D-11/D-12, Plan 04-01).
//
// Tracks consecutive QA failures in content/keywords/pipeline-state.json.
// If consecutiveFailures >= 3 (K=3), trips paused: true, generates
// content/quarantine/ALERT.md, prints high-visibility stderr banner,
// and halts all subsequent pipeline runs during preflight until manual
// 'npm run pipeline:resume'.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

export interface FailureRecord {
  id: string;
  failedRule: string;
  timestamp: string;
}

export interface PipelineState {
  paused: boolean;
  pausedAt?: string;
  consecutiveFailures: number;
  failureHistory: FailureRecord[];
  reason?: string;
}

export interface CircuitBreakerOptions {
  keywordsDir?: string;
  quarantineDir?: string;
  maxConsecutive?: number;
}

const DEFAULT_KEYWORDS_DIR = 'content/keywords';
const DEFAULT_QUARANTINE_DIR = 'content/quarantine';
const DEFAULT_MAX_CONSECUTIVE = 3;

function getStatePath(keywordsDir?: string): string {
  return join(resolve(keywordsDir ?? DEFAULT_KEYWORDS_DIR), 'pipeline-state.json');
}

function getAlertPath(quarantineDir?: string): string {
  return join(resolve(quarantineDir ?? DEFAULT_QUARANTINE_DIR), 'ALERT.md');
}

/**
 * Reads persistent pipeline state from pipeline-state.json.
 * Defaults to healthy unpaused state if file does not exist.
 */
export function readPipelineState(keywordsDir?: string): PipelineState {
  const file = getStatePath(keywordsDir);
  if (!existsSync(file)) {
    return {
      paused: false,
      consecutiveFailures: 0,
      failureHistory: [],
    };
  }

  try {
    const raw = readFileSync(file, 'utf8');
    return JSON.parse(raw) as PipelineState;
  } catch {
    return {
      paused: false,
      consecutiveFailures: 0,
      failureHistory: [],
    };
  }
}

function writePipelineState(state: PipelineState, keywordsDir?: string): void {
  const dir = resolve(keywordsDir ?? DEFAULT_KEYWORDS_DIR);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'pipeline-state.json');
  writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

/**
 * Resets consecutive failures counter to 0 on a successful QA evaluation.
 */
export function recordQaSuccess(keywordsDir?: string): void {
  const state = readPipelineState(keywordsDir);
  if (state.consecutiveFailures > 0) {
    state.consecutiveFailures = 0;
    writePipelineState(state, keywordsDir);
  }
}

/**
 * Emits red ANSI banner to console.error (D-12).
 */
function emitTerminalBanner(state: PipelineState): void {
  const red = '\x1b[41m\x1b[37m\x1b[1m';
  const reset = '\x1b[0m';
  console.error('\n' + '='.repeat(80));
  console.error(`${red}  🚨 CRITICAL: PIPELINE AUTO-PAUSED (CIRCUIT-BREAKER TRIPPED) 🚨  ${reset}`);
  console.error('='.repeat(80));
  console.error(`Reason: ${state.consecutiveFailures} consecutive drafts quarantined.`);
  console.error(`Paused At: ${state.pausedAt}`);
  console.error('Action Required: Review content/quarantine/ALERT.md and run:');
  console.error('  npm run quarantine:list');
  console.error('  npm run pipeline:resume');
  console.error('='.repeat(80) + '\n');
}

/**
 * Generates actionable content/quarantine/ALERT.md (D-12).
 */
function writeAlertFile(state: PipelineState, quarantineDir?: string): void {
  const qDir = resolve(quarantineDir ?? DEFAULT_QUARANTINE_DIR);
  mkdirSync(qDir, { recursive: true });
  const alertPath = join(qDir, 'ALERT.md');

  const historyRows = state.failureHistory
    .slice(-5)
    .map((h) => `| \`${h.id}\` | **${h.failedRule}** | ${h.timestamp} |`)
    .join('\n');

  const content = `# 🚨 PIPELINE AUTO-PAUSED: CIRCUIT BREAKER TRIPPED

**Status:** PAUSED  
**Tripped At:** ${state.pausedAt ?? new Date().toISOString()}  
**Consecutive Failures:** ${state.consecutiveFailures}  
**Reason:** ${state.reason ?? 'Exceeded consecutive QA failure limit'}  

---

## Recent Failure Log
| Draft ID | Failed Rule | Timestamp |
|---|---|---|
${historyRows}

---

## Triage & Recovery Instructions
1. Inspect the quarantined drafts and failure reports:
   \`\`\`bash
   npm run quarantine:list
   npm run quarantine:view <id>
   \`\`\`
2. Fix underlying prompt, keyword, or validation regressions.
3. Reset the circuit breaker and resume publishing:
   \`\`\`bash
   npm run pipeline:resume
   \`\`\`
`;

  writeFileSync(alertPath, content, 'utf8');
}

/**
 * Records a draft failure. If consecutive failures reach maxConsecutive (K=3),
 * trips paused: true, generates ALERT.md, prints banner, and optional webhook.
 * Returns true if tripped into paused state.
 */
export function recordQaFailure(
  failure: { id: string; failedRule: string },
  options?: CircuitBreakerOptions,
): boolean {
  const maxConsecutive = options?.maxConsecutive ?? DEFAULT_MAX_CONSECUTIVE;
  const state = readPipelineState(options?.keywordsDir);

  const failureRecord: FailureRecord = {
    id: failure.id,
    failedRule: failure.failedRule,
    timestamp: new Date().toISOString(),
  };

  state.consecutiveFailures += 1;
  state.failureHistory = [...(state.failureHistory || []), failureRecord].slice(-10);

  let tripped = false;
  if (state.consecutiveFailures >= maxConsecutive) {
    state.paused = true;
    state.pausedAt = new Date().toISOString();
    state.reason = `Circuit breaker tripped after ${state.consecutiveFailures} consecutive QA failures`;
    tripped = true;

    writeAlertFile(state, options?.quarantineDir);
    emitTerminalBanner(state);

    // Optional webhook dispatch (D-12)
    const webhookUrl = process.env.ALERT_WEBHOOK_URL;
    if (webhookUrl && typeof fetch === 'function') {
      try {
        void fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'PIPELINE_AUTO_PAUSED',
            consecutiveFailures: state.consecutiveFailures,
            reason: state.reason,
            failureHistory: state.failureHistory,
          }),
        }).catch(() => {
          // Graceful ignore
        });
      } catch {
        // Ignore webhook error
      }
    }
  }

  writePipelineState(state, options?.keywordsDir);
  return tripped;
}

/**
 * Resets circuit breaker to unpaused, clearing consecutiveFailures and resolving ALERT.md.
 */
export function resetCircuitBreaker(
  keywordsDir?: string,
  quarantineDir?: string,
): PipelineState {
  const state = readPipelineState(keywordsDir);
  state.paused = false;
  state.consecutiveFailures = 0;
  state.reason = undefined;
  writePipelineState(state, keywordsDir);

  const alertFile = getAlertPath(quarantineDir);
  if (existsSync(alertFile)) {
    try {
      unlinkSync(alertFile);
    } catch {
      // Ignore unlink error
    }
  }

  return state;
}
