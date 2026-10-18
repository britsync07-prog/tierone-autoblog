// CLI viewer for detailed quarantine audit report (D-03).
// Run: npm run quarantine:view <id>
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const quarantineDir = join(ROOT, 'content', 'quarantine');

const id = process.argv[2];
if (!id) {
  console.error('Usage: npm run quarantine:view <id>');
  process.exit(1);
}

const reportPath = join(quarantineDir, `${id}-report.json`);
const mdxPath = join(quarantineDir, `${id}.mdx`);

if (!existsSync(reportPath)) {
  console.error(`FAIL: No quarantine report found for ID '${id}' (expected ${reportPath})`);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(readFileSync(reportPath, 'utf8'));
} catch (err) {
  console.error(`FAIL: Corrupt report JSON: ${err.message}`);
  process.exit(1);
}

console.log('\n' + '='.repeat(70));
console.log(`  QUARANTINE AUDIT REPORT: ${report.id}`);
console.log('='.repeat(70));
console.log(`Failed Gate:          ${report.failedGate}`);
console.log(`Score:                ${report.score !== undefined ? report.score : 'N/A'}`);
console.log(`Timestamp:            ${report.timestamp}`);
console.log(`Source Path:          ${report.sourcePostPath}`);
console.log(`Quarantine Path:      ${report.quarantinePath}`);
console.log('\nDetails:');
console.log(`  ${report.details}`);

if (report.remediationSteps && report.remediationSteps.length > 0) {
  console.log('\nSuggested Remediation:');
  report.remediationSteps.forEach((step, i) => {
    console.log(`  ${i + 1}. ${step}`);
  });
}

if (existsSync(mdxPath)) {
  console.log('\nQuarantined MDX Preview (first 25 lines):');
  console.log('-'.repeat(70));
  const lines = readFileSync(mdxPath, 'utf8').split('\n').slice(0, 25);
  console.log(lines.join('\n'));
  console.log('-'.repeat(70));
}

console.log('\n');
