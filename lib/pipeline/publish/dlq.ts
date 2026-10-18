// Dead Letter Queue (DLQ) & 3-strike quarantine escalation (Plan 05-02, D-03).
//
// Tracks transient publishing failures in content/keywords/dlq.json.
// If an entry accumulates >= 3 failures (K=3), it is escalated to quarantine:
// - moved out of content/posts/ via quarantineDraft
// - registry stage transitioned to 'quarantined'
// - circuit breaker failure logged (recordQaFailure)
// - alert banner appended to content/quarantine/ALERT.md
// This isolates poison-pill drafts without stalling the autonomous publishing engine.

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import type { SiloSlug } from '../../silos';
import { loadShard, quarantineEntry, saveShard } from '../registry';
import { quarantineDraft } from '../qa/quarantine';
import { recordQaFailure } from '../qa/circuit-breaker';

export interface DlqEntry {
  entryId: string;
  silo: string;
  attempts: number;
  firstFailedAt: string;
  lastAttemptAt: string;
  lastError: string;
}

export interface DlqState {
  version: 1;
  updatedAt: string;
  entries: DlqEntry[];
}

export interface DlqOptions {
  keywordsDir?: string;
  quarantineDir?: string;
  postsDir?: string;
}

const DEFAULT_KEYWORDS_DIR = 'content/keywords';
const DEFAULT_QUARANTINE_DIR = 'content/quarantine';
const DEFAULT_POSTS_DIR = 'content/posts';

function getDlqPath(keywordsDir?: string): string {
  return join(resolve(keywordsDir ?? DEFAULT_KEYWORDS_DIR), 'dlq.json');
}

/**
 * Reads persistent DLQ state from content/keywords/dlq.json.
 */
export function readDlq(keywordsDir?: string): DlqState {
  const file = getDlqPath(keywordsDir);
  if (!existsSync(file)) {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      entries: [],
    };
  }

  try {
    const raw = readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.entries)) {
      return parsed as DlqState;
    }
  } catch {
    // Corrupt file fallback
  }

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    entries: [],
  };
}

/**
 * Writes persistent DLQ state to content/keywords/dlq.json.
 */
export function writeDlq(state: DlqState, keywordsDir?: string): void {
  const dir = resolve(keywordsDir ?? DEFAULT_KEYWORDS_DIR);
  mkdirSync(dir, { recursive: true });
  state.updatedAt = new Date().toISOString();
  writeFileSync(getDlqPath(keywordsDir), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

/**
 * Retrieves a DLQ entry by entryId if present.
 */
export function getDlqEntry(entryId: string, keywordsDir?: string): DlqEntry | undefined {
  const state = readDlq(keywordsDir);
  return state.entries.find((e) => e.entryId === entryId);
}

/**
 * Checks whether an entry has exhausted its DLQ attempts (>= 3).
 */
export function checkDlqExhaustion(entryId: string, keywordsDir?: string): boolean {
  const entry = getDlqEntry(entryId, keywordsDir);
  return Boolean(entry && entry.attempts >= 3);
}

/**
 * Removes an entry from DLQ upon successful publication.
 */
export function clearDlqEntry(entryId: string, keywordsDir?: string): void {
  const state = readDlq(keywordsDir);
  const initialLen = state.entries.length;
  state.entries = state.entries.filter((e) => e.entryId !== entryId);
  if (state.entries.length !== initialLen) {
    writeDlq(state, keywordsDir);
  }
}

/**
 * Records a publish attempt failure in content/keywords/dlq.json.
 * If attempts reach 3, automatically quarantines the draft, updates the registry,
 * triggers the circuit breaker, and appends an alert banner to ALERT.md.
 */
export function recordDlqFailure(
  entryId: string,
  silo: string,
  error: string,
  optionsOrKeywordsDir?: string | DlqOptions,
  quarantineDirArg?: string,
  postsDirArg?: string,
): { exhausted: boolean; attempts: number } {
  let keywordsDir: string | undefined;
  let quarantineDir: string | undefined;
  let postsDir: string | undefined;

  if (typeof optionsOrKeywordsDir === 'object' && optionsOrKeywordsDir !== null) {
    keywordsDir = optionsOrKeywordsDir.keywordsDir;
    quarantineDir = optionsOrKeywordsDir.quarantineDir;
    postsDir = optionsOrKeywordsDir.postsDir;
  } else {
    keywordsDir = optionsOrKeywordsDir;
    quarantineDir = quarantineDirArg;
    postsDir = postsDirArg;
  }

  const now = new Date().toISOString();
  const state = readDlq(keywordsDir);
  let dlqItem = state.entries.find((e) => e.entryId === entryId);

  if (!dlqItem) {
    dlqItem = {
      entryId,
      silo,
      attempts: 1,
      firstFailedAt: now,
      lastAttemptAt: now,
      lastError: error,
    };
    state.entries.push(dlqItem);
  } else {
    dlqItem.attempts += 1;
    dlqItem.lastAttemptAt = now;
    dlqItem.lastError = error;
  }

  if (dlqItem.attempts >= 3) {
    // 3-strike exhaustion: isolate draft to quarantine
    const targetKeywordsDir = keywordsDir ?? DEFAULT_KEYWORDS_DIR;
    const targetQuarantineDir = quarantineDir ?? DEFAULT_QUARANTINE_DIR;
    const targetPostsDir = postsDir ?? DEFAULT_POSTS_DIR;

    let draftSlug = entryId;

    // 1. Try to load candidate registry shard and update entry
    try {
      const shard = loadShard(targetKeywordsDir, silo as SiloSlug);
      const registryEntry = shard.keywords.find((k) => k.id === entryId);
      if (registryEntry) {
        if (registryEntry.draft?.slug) {
          draftSlug = registryEntry.draft.slug;
        }
        quarantineEntry(registryEntry, {
          failedRule: 'publish_dlq_exhausted',
          score: dlqItem.attempts,
          reportPath: join(targetQuarantineDir, `${entryId}-report.json`),
          quarantinedAt: now,
        });
        saveShard(targetKeywordsDir, silo as SiloSlug, shard);
      }
    } catch (shardErr) {
      console.warn(
        `[dlq] Warning: could not update registry shard for ${entryId}: ${shardErr instanceof Error ? shardErr.message : String(shardErr)}`,
      );
    }

    // 2. Quarantine draft physical file and create audit report
    try {
      quarantineDraft({
        id: entryId,
        slug: draftSlug,
        failedGate: 'publish_dlq_exhausted',
        score: dlqItem.attempts,
        details: `Publishing failed ${dlqItem.attempts} consecutive times. Last error: ${error}`,
        remediationSteps: [
          'Inspect build or deployment errors in logs',
          'Verify MDX content and frontmatter compile correctly',
          'Fix underlying issues and restore from quarantine',
        ],
        postsDir: targetPostsDir,
        quarantineDir: targetQuarantineDir,
      });
    } catch (qErr) {
      console.warn(`[dlq] Warning: quarantineDraft failed for ${entryId}: ${qErr}`);
    }

    // 3. Record in circuit breaker
    try {
      recordQaFailure(
        { id: entryId, failedRule: 'publish_dlq_exhausted' },
        { keywordsDir: targetKeywordsDir, quarantineDir: targetQuarantineDir },
      );
    } catch (cbErr) {
      console.warn(`[dlq] Warning: recordQaFailure failed for ${entryId}: ${cbErr}`);
    }

    // 4. Append alert banner to content/quarantine/ALERT.md
    try {
      const qDirResolved = resolve(targetQuarantineDir);
      mkdirSync(qDirResolved, { recursive: true });
      const alertPath = join(qDirResolved, 'ALERT.md');
      const banner = `\n> ⚠️ **DLQ Exhausted Alert**: Entry \`${entryId}\` reached ${dlqItem.attempts} failed publishing attempts and was moved to quarantine. Last error: ${error}\n`;
      if (existsSync(alertPath)) {
        appendFileSync(alertPath, banner, 'utf8');
      } else {
        writeFileSync(alertPath, `# 🚨 QUARANTINE ALERT\n${banner}\n`, 'utf8');
      }
    } catch (alertErr) {
      console.warn(`[dlq] Warning: failed to write ALERT.md banner for ${entryId}: ${alertErr}`);
    }

    writeDlq(state, keywordsDir);
    return { exhausted: true, attempts: dlqItem.attempts };
  }

  writeDlq(state, keywordsDir);
  return { exhausted: false, attempts: dlqItem.attempts };
}
