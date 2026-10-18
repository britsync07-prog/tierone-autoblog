// Quarantine storage manager (D-01/D-02/D-03, Plan 04-01).
//
// Failed drafts are physically isolated from Next.js Content Collections by
// moving the .mdx file out of content/posts/ to content/quarantine/{id}.mdx.
// Every quarantined draft is paired with an audit JSON report
// ({id}-report.json) and listed in the automatically generated
// content/quarantine/SUMMARY.md index.

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

export interface QuarantineReport {
  id: string;
  slug: string;
  failedGate: string;
  score?: number | string;
  details: string;
  timestamp: string;
  remediationSteps: string[];
  sourcePostPath: string;
  quarantinePath: string;
}

export interface QuarantineDraftOptions {
  id: string;
  slug: string;
  failedGate: string;
  score?: number | string;
  details: string;
  remediationSteps?: string[];
  postsDir?: string;
  quarantineDir?: string;
}

const DEFAULT_POSTS_DIR = 'content/posts';
const DEFAULT_QUARANTINE_DIR = 'content/quarantine';

/**
 * Physically isolates a failed draft by moving it from postsDir to quarantineDir,
 * generating a companion audit report JSON, and updating SUMMARY.md.
 */
export function quarantineDraft(options: QuarantineDraftOptions): QuarantineReport {
  const postsDir = resolve(options.postsDir ?? DEFAULT_POSTS_DIR);
  const quarantineDir = resolve(options.quarantineDir ?? DEFAULT_QUARANTINE_DIR);

  mkdirSync(quarantineDir, { recursive: true });

  const sourcePostPath = join(postsDir, `${options.slug}.mdx`);
  const targetPostPath = join(quarantineDir, `${options.id}.mdx`);
  const reportPath = join(quarantineDir, `${options.id}-report.json`);

  const timestamp = new Date().toISOString();
  const remediationSteps = options.remediationSteps ?? [
    'Inspect report details and failure reason',
    'Revise draft or prompt guidelines to address the failing quality gate',
    'Re-run QA or reset keyword stage to re-generate',
  ];

  if (existsSync(sourcePostPath)) {
    // Move post out of postsDir into quarantineDir
    try {
      renameSync(sourcePostPath, targetPostPath);
    } catch {
      // Fallback cross-device move if renameSync fails
      const content = readFileSync(sourcePostPath, 'utf8');
      writeFileSync(targetPostPath, content, 'utf8');
      unlinkSync(sourcePostPath);
    }
  }

  const report: QuarantineReport = {
    id: options.id,
    slug: options.slug,
    failedGate: options.failedGate,
    score: options.score,
    details: options.details,
    timestamp,
    remediationSteps,
    sourcePostPath,
    quarantinePath: targetPostPath,
  };

  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  updateQuarantineSummary(quarantineDir);

  return report;
}

/**
 * Scans quarantine directory for all *-report.json files and writes
 * an updated markdown table in SUMMARY.md (D-03).
 */
export function updateQuarantineSummary(quarantineDir?: string): void {
  const dir = resolve(quarantineDir ?? DEFAULT_QUARANTINE_DIR);
  if (!existsSync(dir)) return;

  const reportFiles = readdirSync(dir).filter(
    (f) => f.endsWith('-report.json') && !f.startsWith('.'),
  );

  const reports: QuarantineReport[] = [];
  for (const f of reportFiles) {
    try {
      const raw = readFileSync(join(dir, f), 'utf8');
      reports.push(JSON.parse(raw) as QuarantineReport);
    } catch {
      // Ignore unparseable reports
    }
  }

  reports.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

  const lines: string[] = [
    '# Quarantined Drafts Summary',
    '',
    `*Last updated: ${new Date().toISOString()}*`,
    `*Total quarantined: ${reports.length}*`,
    '',
  ];

  if (reports.length === 0) {
    lines.push('No quarantined drafts currently.');
  } else {
    lines.push('| ID | Failed Gate | Score | Quarantined At | Summary |');
    lines.push('|---|---|---|---|---|');
    for (const r of reports) {
      const scoreStr = r.score !== undefined ? String(r.score) : '-';
      const cleanDetails = r.details.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
      lines.push(
        `| \`${r.id}\` | **${r.failedGate}** | ${scoreStr} | ${r.timestamp} | ${cleanDetails} |`,
      );
    }
  }

  lines.push('');
  writeFileSync(join(dir, 'SUMMARY.md'), lines.join('\n'), 'utf8');
}
