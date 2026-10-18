// Post Retirement Workflow & Physical Quarantine Manager (D-06, GROW-02, T-06-06).
//
// When a post is retired (cannibalized or consolidated into a pillar hub), this module:
// 1. Validates the source post exists and redirect entry is loop-free.
// 2. Physically isolates the MDX file to content/quarantine/ via quarantineDraft.
// 3. Atomically updates the keyword registry entry from 'published' to 'quarantined'.
// 4. Appends and persists the 301 permanent redirect in content/redirects.json.

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { quarantineDraft } from '../qa/quarantine';
import { loadShard, quarantineEntry, saveShard } from '../registry';
import { SILO_SLUGS, type SiloSlug } from '../../silos';
import {
  DEFAULT_REDIRECTS_PATH,
  loadRedirects,
  saveRedirects,
  validateRedirectEntry,
  type RedirectEntry,
} from './registry';

export interface RetirePostOptions {
  slug: string;
  destination?: string;
  targetDestination?: string;
  reason?: string;
  postsDir?: string;
  quarantineDir?: string;
  keywordsDir?: string;
  redirectsFile?: string;
  redirectsPath?: string;
  dryRun?: boolean;
}

export interface RetirePostResult {
  success: boolean;
  retired: boolean;
  redirectedFrom: string;
  destination: string;
  redirectEntry?: RedirectEntry;
  error?: string;
}

const DEFAULT_POSTS_DIR = 'content/posts';
const DEFAULT_QUARANTINE_DIR = 'content/quarantine';
const DEFAULT_KEYWORDS_DIR = 'content/keywords';

/**
 * Retires a published post, moves its MDX file to quarantine, marks the registry entry
 * as quarantined, and records a permanent 301 redirect rule.
 */
export async function retireAndRedirectPost(options: RetirePostOptions): Promise<RetirePostResult> {
  const slug = (options.slug || '').trim();
  const rawDest = (options.destination || options.targetDestination || '').trim();
  const redirectsFile = resolve(options.redirectsFile || options.redirectsPath || DEFAULT_REDIRECTS_PATH);
  const postsDir = resolve(options.postsDir || DEFAULT_POSTS_DIR);
  const quarantineDir = resolve(options.quarantineDir || DEFAULT_QUARANTINE_DIR);
  const keywordsDir = resolve(options.keywordsDir || DEFAULT_KEYWORDS_DIR);
  const reason = options.reason || 'Consolidated post retirement';
  const dryRun = Boolean(options.dryRun);

  const sourcePath = `/blog/${slug}`;

  if (!slug) {
    return {
      success: false,
      retired: false,
      redirectedFrom: '',
      destination: rawDest,
      error: 'Slug is required for post retirement',
    };
  }

  if (!rawDest) {
    return {
      success: false,
      retired: false,
      redirectedFrom: sourcePath,
      destination: '',
      error: 'Destination is required for post retirement',
    };
  }

  // 1. Verify source post file exists
  const postFile = join(postsDir, `${slug}.mdx`);
  if (!existsSync(postFile)) {
    return {
      success: false,
      retired: false,
      redirectedFrom: sourcePath,
      destination: rawDest,
      error: `Post file not found at '${postFile}'`,
    };
  }

  // 2. Validate redirect entry against existing redirects
  const existingRedirects = loadRedirects(redirectsFile);
  const newEntry: RedirectEntry = {
    source: sourcePath,
    destination: rawDest,
    permanent: true,
    reason,
    retiredAt: new Date().toISOString(),
  };

  const validation = validateRedirectEntry(newEntry, existingRedirects);
  if (!validation.valid) {
    return {
      success: false,
      retired: false,
      redirectedFrom: sourcePath,
      destination: rawDest,
      error: validation.error,
    };
  }

  if (dryRun) {
    return {
      success: true,
      retired: false,
      redirectedFrom: sourcePath,
      destination: rawDest,
      redirectEntry: newEntry,
    };
  }

  // 3. Physically isolate the MDX file via quarantineDraft
  quarantineDraft({
    id: slug,
    slug,
    failedGate: '301-consolidated',
    score: 0,
    details: `${reason} -> 301 redirected to ${rawDest}`,
    remediationSteps: [
      `Post ${sourcePath} has been permanently 301-redirected to ${rawDest}.`,
      'The MDX content has been removed from content/posts/ to prevent duplicate compilation and sitemap clutter.',
      'To un-retire, remove the rule from content/redirects.json and restore the MDX from content/quarantine/.',
    ],
    postsDir,
    quarantineDir,
  });

  // 4. Update Keyword Registry entry stage to 'quarantined'
  let foundInRegistry = false;
  for (const silo of SILO_SLUGS) {
    const shardFile = join(keywordsDir, silo, 'registry.json');
    if (!existsSync(shardFile)) continue;

    try {
      const shard = loadShard(keywordsDir, silo);
      const match = shard.keywords.find(
        (k) => k.draft?.slug === slug || k.id === slug,
      );

      if (match) {
        foundInRegistry = true;
        quarantineEntry(match, {
          failedRule: '301-consolidated',
          reportPath: 'content/redirects.json',
          quarantinedAt: new Date().toISOString(),
        });
        saveShard(keywordsDir, silo, shard);
        break;
      }
    } catch (err) {
      console.warn(`[retire] Error updating registry shard ${silo}:`, err);
    }
  }

  if (!foundInRegistry) {
    console.warn(`[retire] Notice: No registry keyword entry found with draft slug or id '${slug}'. Physical file was quarantined and redirect created.`);
  }

  // 5. Append redirect entry to redirects registry
  const updatedRedirects = [...existingRedirects, newEntry];
  saveRedirects(updatedRedirects, redirectsFile);

  return {
    success: true,
    retired: true,
    redirectedFrom: sourcePath,
    destination: rawDest,
    redirectEntry: newEntry,
  };
}
