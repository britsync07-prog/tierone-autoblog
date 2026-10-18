#!/usr/bin/env node
// Silo Topical Cluster Inspector & Pillar Promotion CLI (Plan 06-04, D-09, D-10, GROW-03).
//
// Inspects published article counts per silo to determine which have achieved
// Pillar Hub status (>= 8 articles), checks for cornerstone guide existence,
// verifies bidirectional link health, and optionally queues missing cornerstone guides.

import { analyzeSiloClusters, queueCornerstoneGuide } from '../lib/pipeline/hubs/pillar';

function main() {
  const args = process.argv.slice(2);
  const shouldQueue = args.includes('--queue-cornerstones');

  console.log('\n================================================================================');
  console.log('              🏛️  SILO TOPICAL CLUSTERS & PILLAR HUB STATUS 🏛️                ');
  console.log('================================================================================\n');

  const reports = analyzeSiloClusters();

  console.log(
    '| Silo Slug        | Articles | Status       | Cornerstone Guide       | Missing Links |'
  );
  console.log(
    '|------------------|----------|--------------|-------------------------|---------------|'
  );

  let missingCornerstoneCount = 0;

  for (const r of reports) {
    const status = r.isPillar ? '🌟 PILLAR HUB' : '🌱 ARCHIVE (<8)';
    const cornerstone = r.hasCornerstoneGuide
      ? `✅ ${r.cornerstoneSlug}`
      : '❌ Missing';
    const missingLinks =
      r.missingBidirectionalLinks.length > 0
        ? `⚠️ ${r.missingBidirectionalLinks.length} spoke(s)`
        : '✅ Complete';

    const siloPadded = r.silo.padEnd(16);
    const countPadded = String(r.postCount).padStart(8);
    const statusPadded = status.padEnd(12);
    const cornerstonePadded = cornerstone.padEnd(23);
    const linksPadded = missingLinks.padEnd(13);

    console.log(
      `| ${siloPadded} | ${countPadded} | ${statusPadded} | ${cornerstonePadded} | ${linksPadded} |`
    );

    if (r.isPillar && !r.hasCornerstoneGuide) {
      missingCornerstoneCount += 1;
      if (shouldQueue) {
        const queued = queueCornerstoneGuide(r.silo);
        if (queued) {
          console.log(`   └─> 🚀 Queued cornerstone guide: pillar-${r.silo}-complete-guide`);
        } else {
          console.log(`   └─> ℹ️ Cornerstone candidate already present in registry`);
        }
      }
    }
  }

  console.log('\n================================================================================');
  if (missingCornerstoneCount > 0 && !shouldQueue) {
    console.log(
      `💡 TIP: Found ${missingCornerstoneCount} mature pillar cluster(s) without cornerstone guides.`
    );
    console.log('   Run with --queue-cornerstones to automatically queue flagship guides.\n');
  } else {
    console.log('✅ Topical cluster inspection complete.\n');
  }
}

main();
