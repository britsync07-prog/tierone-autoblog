// CLI table of quarantined drafts (D-03).
// Run: npm run quarantine:list
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const quarantineDir = join(ROOT, 'content', 'quarantine');

if (!existsSync(quarantineDir)) {
  console.log('No quarantined drafts. (content/quarantine does not exist)');
  process.exit(0);
}

const files = readdirSync(quarantineDir).filter(
  (f) => f.endsWith('-report.json') && !f.startsWith('.'),
);

if (files.length === 0) {
  console.log('No quarantined drafts.');
  process.exit(0);
}

const reports = [];
for (const f of files) {
  try {
    const raw = readFileSync(join(quarantineDir, f), 'utf8');
    reports.push(JSON.parse(raw));
  } catch {
    // Ignore corrupt files
  }
}

reports.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

console.log(`\nFound ${reports.length} quarantined draft(s):\n`);

const rows = reports.map((r) => ({
  ID: r.id,
  Gate: r.failedGate,
  Score: r.score !== undefined ? String(r.score) : '-',
  'Quarantined At': r.timestamp,
  Summary: r.details.length > 50 ? r.details.slice(0, 47) + '...' : r.details,
}));

console.table(rows);
console.log('\nTo view a detailed report, run:');
console.log('  npm run quarantine:view <id>\n');
