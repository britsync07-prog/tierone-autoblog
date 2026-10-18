// Automated git rollback engine (D-06, Plan 05-03, AUTO-02).
//
// When post-publish live URL verification fails:
// 1. Physically moves content/posts/{slug}.mdx to content/quarantine/{id}.mdx via quarantineDraft.
// 2. Writes detailed incident report to content/quarantine/{id}-live-fail-report.json.
// 3. Transitions registry entry stage to 'quarantined' with failure metadata.
// 4. Increments circuit-breaker failure count (tripping ALERT.md if threshold reached).
// 5. Commits and pushes [auto-unpublish] to master to restore clean production state.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { quarantineDraft } from '../qa/quarantine';
import { recordQaFailure } from '../qa/circuit-breaker';
import { loadShard, saveShard } from '../registry';
import type { SiloSlug } from '../../silos';
import type { LiveVerificationReport } from './verifier';

const execAsync = promisify(exec);

const DEFAULT_POSTS_DIR = 'content/posts';
const DEFAULT_QUARANTINE_DIR = 'content/quarantine';
const DEFAULT_KEYWORDS_DIR = 'content/keywords';

export interface AutomatedRollbackOptions {
  entryId: string;
  slug: string;
  silo: string;
  failureReport: LiveVerificationReport;
  postsDir?: string;
  quarantineDir?: string;
  keywordsDir?: string;
  dryRun?: boolean;
  execGit?: (cmd: string) => Promise<void>;
}

export interface AutomatedRollbackResult {
  rolledBack: boolean;
  reportPath: string;
}

/**
 * Executes an automated unpublish and rollback when live verification fails.
 */
export async function executeAutomatedRollback(
  options: AutomatedRollbackOptions,
): Promise<AutomatedRollbackResult> {
  const postsDir = options.postsDir ?? DEFAULT_POSTS_DIR;
  const quarantineDir = options.quarantineDir ?? DEFAULT_QUARANTINE_DIR;
  const keywordsDir = options.keywordsDir ?? DEFAULT_KEYWORDS_DIR;

  const resolvedQuarantineDir = resolve(quarantineDir);
  mkdirSync(resolvedQuarantineDir, { recursive: true });

  const timestamp = new Date().toISOString();
  const liveFailReportFileName = `${options.entryId}-live-fail-report.json`;
  const liveFailReportPath = join(resolvedQuarantineDir, liveFailReportFileName);
  const relativeReportPath = join(quarantineDir, liveFailReportFileName).replace(/\\/g, '/');

  // 1. Physically move post out of content/posts to content/quarantine
  quarantineDraft({
    id: options.entryId,
    slug: options.slug,
    failedGate: 'live_verification_failed',
    details: options.failureReport.summary,
    remediationSteps: [
      `Inspect live failure report: ${relativeReportPath}`,
      'Resolve schema errors, eliminate placeholder tokens, and fix dead internal links',
      'Re-run QA and verify local build before re-publishing',
    ],
    postsDir,
    quarantineDir,
  });

  // 2. Write detailed incident JSON report
  const incidentPayload = {
    entryId: options.entryId,
    slug: options.slug,
    silo: options.silo,
    timestamp,
    reason: 'live_verification_failed',
    summary: options.failureReport.summary,
    report: options.failureReport,
  };
  writeFileSync(liveFailReportPath, `${JSON.stringify(incidentPayload, null, 2)}\n`, 'utf8');

  // 3. Update registry shard: transition entry to 'quarantined'
  try {
    const shard = loadShard(keywordsDir, options.silo as SiloSlug);
    const entry = shard.keywords.find((k) => k.id === options.entryId);
    if (entry) {
      entry.stage = 'quarantined';
      entry.quarantine = {
        failedRule: 'live_verification_failed',
        reportPath: relativeReportPath,
        quarantinedAt: timestamp,
      };
      entry.updatedAt = timestamp;
      saveShard(keywordsDir, options.silo as SiloSlug, shard);
    }
  } catch (err) {
    console.error(`[rollback] Warning: Failed to update registry entry ${options.entryId}:`, err);
  }

  // 4. Record failure in circuit-breaker
  recordQaFailure(
    { id: options.entryId, failedRule: 'live_verification_failed' },
    { keywordsDir, quarantineDir },
  );

  // 5. Execute git commit and push if not dryRun
  if (!options.dryRun) {
    const gitCommands = [
      'git add content/posts content/quarantine content/keywords',
      `git commit -m "[auto-unpublish] ${options.slug}: live verification failed [skip ci]"`,
      'git push origin master',
    ];

    if (options.execGit) {
      for (const cmd of gitCommands) {
        await options.execGit(cmd);
      }
    } else {
      for (const cmd of gitCommands) {
        try {
          await execAsync(cmd);
        } catch (gitErr) {
          console.error(`[rollback] Error executing '${cmd}':`, gitErr);
          throw gitErr;
        }
      }
    }
  }

  // 6. High-visibility console alert
  console.error('\n' + '!'.repeat(80));
  console.error(`🚨 [AUTO-UNPUBLISH ROLLBACK] ${options.slug} (${options.entryId})`);
  console.error(`Reason: Live URL verification failed.`);
  console.error(`Quarantine report: ${relativeReportPath}`);
  console.error('!'.repeat(80) + '\n');

  return {
    rolledBack: true,
    reportPath: liveFailReportPath,
  };
}
