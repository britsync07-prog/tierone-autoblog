// Silo Cluster Analysis, Cornerstone Flagship Queuing & Bidirectional Link Mesh (Plan 06-04, D-09, D-10, GROW-03).
//
// Detects when silos reach mature cluster density (>= 8 articles, up to 12),
// verifies cornerstone guide existence, checks bidirectional internal linking,
// and queues flagship /blog/{silo}-complete-guide articles.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SILO_SLUGS, type SiloSlug } from '../../silos';
import { loadShard, saveShard } from '../registry';
import type { RegistryEntry } from '../types';

export interface SiloClusterReport {
  silo: string;
  postCount: number;
  isPillar: boolean;
  hasCornerstoneGuide: boolean;
  cornerstoneSlug?: string;
  missingBidirectionalLinks: Array<{ spokeSlug: string; reason: string }>;
}

const DEFAULT_KEYWORDS_DIR = 'content/keywords';
const DEFAULT_POSTS_DIR = 'content/posts';
const PILLAR_CLUSTER_THRESHOLD = 8;
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+){0,4}$/;

/**
 * Analyzes article density and link mesh health across all silo topical clusters.
 */
export function analyzeSiloClusters(
  keywordsDir?: string,
  postsDir?: string
): SiloClusterReport[] {
  const kDir = keywordsDir ?? DEFAULT_KEYWORDS_DIR;
  const pDir = postsDir ?? DEFAULT_POSTS_DIR;
  const reports: SiloClusterReport[] = [];

  for (const silo of SILO_SLUGS) {
    let publishedEntries: RegistryEntry[] = [];
    try {
      const shard = loadShard(kDir, silo);
      publishedEntries = shard.keywords.filter(
        (k) => k.stage === 'published' && Boolean(k.draft?.slug)
      );
    } catch {
      // Shard may not exist yet in test setups
    }

    const postCount = publishedEntries.length;
    const isPillar = postCount >= PILLAR_CLUSTER_THRESHOLD;

    // Detect cornerstone guide
    const cornerstoneEntry = publishedEntries.find((k) => {
      const slug = k.draft?.slug ?? '';
      return (
        slug === `${silo}-complete-guide` ||
        slug.endsWith('-complete-guide') ||
        slug.includes('complete-guide')
      );
    });

    const hasCornerstoneGuide = Boolean(cornerstoneEntry);
    const cornerstoneSlug = cornerstoneEntry?.draft?.slug;

    // Verify bidirectional link mesh for published spokes
    const missingBidirectionalLinks: Array<{ spokeSlug: string; reason: string }> = [];

    for (const entry of publishedEntries) {
      const spokeSlug = entry.draft!.slug;
      // Skip checking the cornerstone guide itself for linking to itself
      if (spokeSlug === cornerstoneSlug) continue;

      const postFilePath = join(pDir, `${spokeSlug}.mdx`);
      if (existsSync(postFilePath)) {
        try {
          const content = readFileSync(postFilePath, 'utf8');
          // Check for link to silo landing page (e.g. `/${silo}`) or cornerstone guide
          const linksToSilo =
            content.includes(`/${silo}`) ||
            content.includes(`/${silo}/`) ||
            (cornerstoneSlug ? content.includes(`/blog/${cornerstoneSlug}`) : false);

          if (!linksToSilo) {
            missingBidirectionalLinks.push({
              spokeSlug,
              reason: `Missing backlink to silo landing /${silo} or cornerstone guide`,
            });
          }
        } catch {
          // Ignore read error
        }
      }
    }

    reports.push({
      silo,
      postCount,
      isPillar,
      hasCornerstoneGuide,
      cornerstoneSlug,
      missingBidirectionalLinks,
    });
  }

  return reports;
}

/**
 * Queues a cornerstone guide entry in the specified silo's keyword registry.
 * Returns true if successfully queued, false if a cornerstone candidate already exists.
 */
export function queueCornerstoneGuide(silo: string, keywordsDir?: string): boolean {
  const kDir = keywordsDir ?? DEFAULT_KEYWORDS_DIR;
  if (!SILO_SLUGS.includes(silo as SiloSlug)) {
    throw new Error(`Unknown silo: ${silo}`);
  }

  const shard = loadShard(kDir, silo as SiloSlug);

  // Check if cornerstone entry already exists in registry
  const existing = shard.keywords.find((k) => {
    const slug = k.draft?.slug ?? '';
    const id = k.id;
    return (
      id.includes('complete-guide') ||
      slug === `${silo}-complete-guide` ||
      slug.endsWith('-complete-guide') ||
      k.keyword.toLowerCase().includes('complete architectural guide')
    );
  });

  if (existing) {
    return false; // Already present
  }

  // Construct valid registry id adhering to /^[a-z0-9]+(?:-[a-z0-9]+){0,4}$/
  const candidateId = `pillar-${silo}-complete-guide`;
  const safeId = ID_RE.test(candidateId) ? candidateId : `pillar-${silo}-guide`;

  const now = new Date().toISOString();
  const entry: RegistryEntry = {
    id: safeId,
    keyword: `best ${silo} tools and workflows: complete architectural guide`,
    silo: silo as SiloSlug,
    stage: 'filtered',
    createdAt: now,
    updatedAt: now,
  };

  shard.keywords.push(entry);
  shard.updatedAt = now;
  saveShard(kDir, silo as SiloSlug, shard);
  return true;
}
