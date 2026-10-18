#!/usr/bin/env node
// Scheduled Publishing Engine (Plan 05-02, D-01, D-02, D-03).
//
// Selects QA-passed drafted candidates in FIFO order by qa.passedAt,
// acquires an idempotent SHA-256 claim lock, transitions the registry entry
// to 'published', dispatches dual-track indexing (IndexNow + GSC),
// clears any DLQ entries, and releases the claim lock.
//
// In case of publishing errors, catches the exception, records the failure in DLQ
// (escalating to quarantine on the 3rd attempt), releases the lock, and exits with code 1.

import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { SILO_SLUGS, type SiloSlug } from '../lib/silos';
import { loadShard, publishEntry, saveShard } from '../lib/pipeline/registry';
import { acquireClaimLock, releaseClaimLock } from '../lib/pipeline/publish/claim-lock';
import { clearDlqEntry, checkDlqExhaustion, recordDlqFailure } from '../lib/pipeline/publish/dlq';
import { dispatchDualTrackIndexing } from '../lib/pipeline/indexing';
import { SITE_URL } from '../lib/site';
import type { RegistryEntry } from '../lib/pipeline/types';

export interface PublishOptions {
  candidateId?: string;
  dryRun?: boolean;
  keywordsDir?: string;
  quarantineDir?: string;
  postsDir?: string;
  siteUrl?: string;
}

export interface PublishResult {
  status: 'published' | 'skipped' | 'locked' | 'dry-run';
  candidateId?: string;
  slug?: string;
  reason?: string;
}

/**
 * Scans all silo shards for QA-passed drafted candidates not exhausted in DLQ.
 * Returns sorted candidates in FIFO order by qa.passedAt.
 */
export function findPublishableCandidates(keywordsDir?: string): RegistryEntry[] {
  const candidates: RegistryEntry[] = [];

  for (const silo of SILO_SLUGS) {
    try {
      const shard = loadShard(keywordsDir ?? 'content/keywords', silo);
      for (const entry of shard.keywords) {
        if (
          entry.stage === 'drafted' &&
          entry.qa?.passedAt &&
          entry.draft?.slug &&
          !checkDlqExhaustion(entry.id, keywordsDir)
        ) {
          candidates.push(entry);
        }
      }
    } catch {
      // Shard may not exist yet or be empty
    }
  }

  candidates.sort((a, b) => {
    const timeA = Date.parse(a.qa!.passedAt);
    const timeB = Date.parse(b.qa!.passedAt);
    if (!Number.isNaN(timeA) && !Number.isNaN(timeB) && timeA !== timeB) {
      return timeA - timeB;
    }
    return a.id.localeCompare(b.id);
  });

  return candidates;
}

/**
 * Core publishing engine logic.
 */
export async function runPublishScheduled(options: PublishOptions = {}): Promise<PublishResult> {
  const keywordsDir = options.keywordsDir ?? 'content/keywords';
  const siteUrl = options.siteUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? SITE_URL ?? 'https://exclusivesources.online';

  let candidate: RegistryEntry | undefined;

  if (options.candidateId) {
    // Find forced candidate across shards
    for (const silo of SILO_SLUGS) {
      try {
        const shard = loadShard(keywordsDir, silo);
        const match = shard.keywords.find((k) => k.id === options.candidateId);
        if (match) {
          if (match.stage !== 'drafted') {
            console.warn(`[publish] Forced candidate ${options.candidateId} is at stage '${match.stage}', not 'drafted'`);
          }
          candidate = match;
          break;
        }
      } catch {
        // ignore
      }
    }

    if (!candidate) {
      console.error(`[publish] Forced candidate ${options.candidateId} not found in any silo shard.`);
      return { status: 'skipped', reason: `Forced candidate ${options.candidateId} not found` };
    }
  } else {
    const candidates = findPublishableCandidates(keywordsDir);
    if (candidates.length === 0) {
      console.log('[publish] No QA-passed drafts waiting to publish.');
      return { status: 'skipped', reason: 'No QA-passed drafts waiting to publish' };
    }
    candidate = candidates[0];
  }

  console.log(`[publish] Selected candidate: ${candidate.id} (${candidate.keyword})`);

  // Acquire claim lock
  const claim = acquireClaimLock(candidate.id, candidate.updatedAt, keywordsDir);
  if (!claim.success) {
    console.log(`[publish] Could not acquire claim lock for ${candidate.id}: ${claim.reason}`);
    return { status: 'locked', candidateId: candidate.id, reason: claim.reason };
  }

  if (options.dryRun) {
    console.log(`[publish] [DRY RUN] Would publish candidate ${candidate.id} (${candidate.draft?.slug}).`);
    releaseClaimLock(claim.hash, keywordsDir);
    return { status: 'dry-run', candidateId: candidate.id, slug: candidate.draft?.slug };
  }

  try {
    const shard = loadShard(keywordsDir, candidate.silo);
    const entryToPublish = shard.keywords.find((k) => k.id === candidate.id);
    if (!entryToPublish) {
      throw new Error(`Candidate entry ${candidate.id} disappeared from shard ${candidate.silo}`);
    }

    // Advance to published stage
    publishEntry(entryToPublish);
    saveShard(keywordsDir, candidate.silo, shard);

    const slug = entryToPublish.draft!.slug;
    const cleanSiteUrl = siteUrl.replace(/\/$/, '');
    const postUrl = `${cleanSiteUrl}/blog/${slug}`;
    const sitemapUrl = `${cleanSiteUrl}/sitemap.xml`;

    console.log(`[publish] Dispatching dual-track indexing for ${postUrl}`);
    await dispatchDualTrackIndexing({
      postUrl,
      slug,
      sitemapUrl,
      siteUrl: cleanSiteUrl,
      keywordsDir,
    });

    clearDlqEntry(candidate.id, keywordsDir);
    releaseClaimLock(claim.hash, keywordsDir);

    console.log(`[publish] Successfully published ${candidate.id} (${slug})`);
    return { status: 'published', candidateId: candidate.id, slug };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[publish] Publication failed for ${candidate.id}:`, err);

    recordDlqFailure(candidate.id, candidate.silo, errorMsg, {
      keywordsDir,
      quarantineDir: options.quarantineDir,
      postsDir: options.postsDir,
    });

    releaseClaimLock(claim.hash, keywordsDir);
    throw err;
  }
}

// CLI execution harness
if (
  process.argv[1] &&
  (process.argv[1].endsWith('publish-scheduled.ts') ||
    process.argv[1].endsWith('publish-scheduled.js') ||
    resolve(process.argv[1]) === fileURLToPath(import.meta.url))
) {
  const args = process.argv.slice(2);
  let candidateId: string | undefined;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg.startsWith('--candidate=')) {
      candidateId = arg.split('=')[1];
    } else if (arg === '--candidate' && args[i + 1]) {
      candidateId = args[++i];
    } else if (!arg.startsWith('--') && !candidateId) {
      candidateId = arg.trim() || undefined;
    }
  }

  runPublishScheduled({ candidateId, dryRun })
    .then((result) => {
      if (result.status === 'skipped' && result.reason?.includes('not found')) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch(() => {
      process.exit(1);
    });
}
