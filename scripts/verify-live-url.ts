#!/usr/bin/env node
// CLI Live URL Verification & Rollback Tool (Plan 05-03, AUTO-02).
//
// Usage:
//   npx tsx scripts/verify-live-url.ts <url-or-slug> [--rollback] [--candidate=<id>] [--silo=<silo>]
//
// Checks HTTP 200, JSON-LD (Article + Breadcrumb), banned placeholder tokens, and internal link health.
// If --rollback is provided and checks fail, automatically executes git unpublish rollback.

import { verifyLiveUrl } from '../lib/pipeline/publish/verifier';
import { executeAutomatedRollback } from '../lib/pipeline/publish/rollback';
import { SITE_URL } from '../lib/site';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let targetArg: string | undefined;
  let shouldRollback = false;
  let candidateId: string | undefined;
  let silo: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--rollback') {
      shouldRollback = true;
    } else if (arg.startsWith('--candidate=')) {
      candidateId = arg.split('=')[1];
    } else if (arg === '--candidate' && args[i + 1]) {
      candidateId = args[++i];
    } else if (arg.startsWith('--silo=')) {
      silo = arg.split('=')[1];
    } else if (arg === '--silo' && args[i + 1]) {
      silo = args[++i];
    } else if (!arg.startsWith('--') && !targetArg) {
      targetArg = arg.trim();
    }
  }

  if (!targetArg) {
    console.error('Usage: npx tsx scripts/verify-live-url.ts <url-or-slug> [--rollback] [--candidate=<id>] [--silo=<silo>]');
    process.exit(1);
  }

  const baseSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || SITE_URL || 'https://exclusivesources.online';
  const cleanBase = baseSiteUrl.replace(/\/$/, '');

  let liveUrl = targetArg;
  if (!liveUrl.startsWith('http://') && !liveUrl.startsWith('https://')) {
    const slug = liveUrl.replace(/^\/blog\//, '').replace(/^\//, '');
    liveUrl = `${cleanBase}/blog/${slug}`;
  }

  console.log(`[verify-live-url] Probing live URL: ${liveUrl}`);

  const report = await verifyLiveUrl(liveUrl, {
    siteUrl: cleanBase,
    timeoutMs: 180000,
  });

  console.log('\n================================================================================');
  console.log(`Live Verification Report: ${liveUrl}`);
  console.log(`Status: ${report.passed ? '✅ PASSED' : '❌ FAILED'} (Duration: ${report.durationMs}ms, HTTP: ${report.status})`);
  console.log('================================================================================');

  for (const check of report.checks) {
    const symbol = check.passed ? '✔' : '✖';
    console.log(`${symbol} [${check.name}]: ${check.message}`);
  }

  if (report.placeholders.matches.length > 0) {
    console.log('\nDetected Placeholder Tokens:');
    for (const m of report.placeholders.matches) {
      console.log(`  - "${m}"`);
    }
  }

  if (report.links.brokenLinks.length > 0) {
    console.log('\nBroken Internal Links:');
    for (const l of report.links.brokenLinks) {
      console.log(`  - ${l.href} (HTTP ${l.status})`);
    }
  }

  console.log('================================================================================\n');

  if (!report.passed) {
    if (shouldRollback) {
      const slugMatch = liveUrl.match(/\/blog\/([^/?#]+)/);
      const slug = slugMatch ? slugMatch[1] : targetArg;
      const id = candidateId || slug;
      const detectedSilo = silo || 'coding';

      console.log(`[verify-live-url] Triggering automated rollback for ${slug}...`);
      await executeAutomatedRollback({
        entryId: id,
        slug,
        silo: detectedSilo,
        failureReport: report,
      });
      console.log(`[verify-live-url] Rollback complete.`);
    }

    process.exit(1);
  }

  process.exit(0);
}

void main().catch((err) => {
  console.error('[verify-live-url] Fatal error:', err);
  process.exit(1);
});
