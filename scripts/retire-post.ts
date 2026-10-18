#!/usr/bin/env tsx
// CLI tool for retiring and consolidating cannibalized blog posts (D-06, GROW-02).
//
// Usage:
//   npx tsx scripts/retire-post.ts --slug <slug> --destination <destination> [--reason <reason>] [--dry-run]
//   npx tsx scripts/retire-post.ts <slug> <destination> [reason]

import { retireAndRedirectPost } from '../lib/pipeline/redirects/retire';

function printUsage(): void {
  console.log(`
Usage:
  npx tsx scripts/retire-post.ts --slug <slug> --destination <destination> [--reason <reason>] [--dry-run]
  npx tsx scripts/retire-post.ts <slug> <destination> [reason]

Options:
  --slug, -s         Slug of the post to retire (e.g. 'old-guide-2024')
  --destination, -d  Target path for 301 redirect (e.g. '/blog/complete-guide-2026')
  --reason, -r       Explanation for retirement / consolidation
  --dry-run          Validate inputs and simulate retirement without file changes
  --help, -h         Show this help message
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    printUsage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  let slug = '';
  let destination = '';
  let reason = '';
  let dryRun = false;

  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--slug' || arg === '-s') {
      slug = args[++i] || '';
    } else if (arg === '--destination' || arg === '-d') {
      destination = args[++i] || '';
    } else if (arg === '--reason' || arg === '-r') {
      reason = args[++i] || '';
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (!arg.startsWith('-')) {
      positional.push(arg);
    }
  }

  if (!slug && positional[0]) {
    slug = positional[0];
  }
  if (!destination && positional[1]) {
    destination = positional[1];
  }
  if (!reason && positional[2]) {
    reason = positional.slice(2).join(' ');
  }

  if (!slug || !destination) {
    console.error('Error: Both --slug and --destination are required.\n');
    printUsage();
    process.exit(1);
  }

  console.log(`[retire] Processing post retirement for '${slug}' -> '${destination}'...`);
  if (dryRun) {
    console.log('[retire] Mode: DRY RUN (no files will be moved or modified)');
  }

  const result = await retireAndRedirectPost({
    slug,
    destination,
    reason: reason || undefined,
    dryRun,
  });

  if (!result.success) {
    console.error(`[retire] FAILED: ${result.error}`);
    process.exit(1);
  }

  if (dryRun) {
    console.log(`[retire] [DRY RUN SUCCESS] Validated 301 redirect: ${result.redirectedFrom} -> ${result.destination}`);
  } else {
    console.log(`[retire] Post ${result.redirectedFrom} retired -> 301 permanent redirect to ${result.destination}`);
    console.log(`[retire] MDX file moved to content/quarantine/${slug}.mdx`);
    console.log('[retire] content/redirects.json updated successfully.');
  }
}

main().catch((err) => {
  console.error('[retire] Unexpected fatal error:', err);
  process.exit(1);
});
