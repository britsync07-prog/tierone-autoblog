import type { GscSearchRow } from '../analytics/types';
import type {
  ContentDecayResult,
  RefreshQueueItem,
  StrikingDistanceQuery,
} from './types';

export interface StrikingDistanceOptions {
  minPosition?: number;
  maxPosition?: number;
  minImpressions?: number;
}

export interface ContentDecayPageInput {
  page: string;
  current30d: { impressions: number; clicks: number };
  prior30d: { impressions: number; clicks: number };
  publishedAt: string;
  silo?: string;
}

export interface ContentDecayOptions {
  minAgeDays?: number;
  minPriorImpressions?: number;
  dropThresholdPct?: number;
  now?: Date;
}

/**
 * Strips hostname/protocol and extracts slug from a page URL or path.
 * e.g. "https://domain.com/blog/best-ai-tools" -> "best-ai-tools"
 * or "/blog/best-ai-tools" -> "best-ai-tools"
 */
export function extractSlugFromPage(page: string): string {
  const cleanPath = page.replace(/^https?:\/\/[^/]+/, '');
  const segments = cleanPath.split('/').filter(Boolean);
  if (segments.length === 0) return 'home';
  // If format is /blog/slug or /[silo]/slug or /slug
  return segments[segments.length - 1];
}

/**
 * Identifies search queries ranking in striking distance (positions 5.0 to 20.0 with >= 50 impressions).
 * Formula: OpportunityScore = impressions * (21.0 - position)
 * Returns queries sorted descending by opportunityScore.
 */
export function detectStrikingDistance(
  rows: GscSearchRow[],
  options?: StrikingDistanceOptions
): StrikingDistanceQuery[] {
  const minPos = options?.minPosition ?? 5.0;
  const maxPos = options?.maxPosition ?? 20.0;
  const minImpr = options?.minImpressions ?? 50;

  const matches: StrikingDistanceQuery[] = [];

  for (const row of rows) {
    if (row.position >= minPos && row.position <= maxPos && row.impressions >= minImpr) {
      const opportunityScore = row.impressions * (21.0 - row.position);
      const slug = extractSlugFromPage(row.page);
      matches.push({
        query: row.query,
        page: row.page,
        slug,
        position: row.position,
        impressions: row.impressions,
        clicks: row.clicks,
        opportunityScore: Math.round(opportunityScore * 100) / 100,
        suggestedFaq: {
          q: `What should you know about ${row.query}?`,
          a: `Understanding ${row.query} is essential for optimizing workflow performance and achieving accurate, consistent results.`,
        },
      });
    }
  }

  // Sort descending by opportunity score
  matches.sort((a, b) => b.opportunityScore - a.opportunityScore);

  return matches;
}

/**
 * Builds actionable RefreshQueueItems from striking-distance query opportunities.
 * Groups by slug and generates prioritized queue entries.
 */
export function buildStrikingDistanceQueueItems(
  queries: StrikingDistanceQuery[],
  existingPosts?: Array<{ slug: string; silo: string }>,
  now: Date = new Date()
): RefreshQueueItem[] {
  const bySlug = new Map<string, StrikingDistanceQuery[]>();

  for (const q of queries) {
    const slug = q.slug || extractSlugFromPage(q.page);
    const existing = bySlug.get(slug) || [];
    existing.push(q);
    bySlug.set(slug, existing);
  }

  const items: RefreshQueueItem[] = [];
  const monthStr = now.toISOString().slice(0, 7); // YYYY-MM

  for (const [slug, slugQueries] of bySlug.entries()) {
    const postMeta = existingPosts?.find((p) => p.slug === slug);
    const silo = postMeta?.silo ?? 'ai-writing';

    const maxOppScore = Math.max(...slugQueries.map((q) => q.opportunityScore));
    // Priority scaled 1 to 10 based on opportunity score
    const priority = Math.min(10, Math.max(1, Math.round(maxOppScore / 200) || 5));

    const totalImpressions = slugQueries.reduce((acc, q) => acc + q.impressions, 0);
    const topQuery = slugQueries[0];

    items.push({
      id: `refresh-${slug}-${monthStr}`,
      slug,
      silo,
      type: 'striking-distance',
      priority,
      detectedAt: now.toISOString(),
      status: 'pending',
      diagnostics: {
        currentImpressions: totalImpressions,
        queries: slugQueries.slice(0, 5).map((q) => ({
          query: q.query,
          position: q.position,
          impressions: q.impressions,
          clicks: q.clicks,
        })),
      },
      suggestedActions: [
        {
          action: 'bump-date-modified',
          details: 'Bump dateModified in frontmatter to signal freshness',
        },
        {
          action: 'inject-faq',
          faqItem: topQuery?.suggestedFaq ?? {
            q: `What should you know about ${topQuery?.query ?? slug}?`,
            a: `Key insights and best practices regarding ${topQuery?.query ?? slug}.`,
          },
          details: `Inject striking-distance FAQ targeting query: "${topQuery?.query}"`,
        },
        {
          action: 'repair-links',
          details: 'Audit outbound links to eliminate 404s',
        },
      ],
    });
  }

  return items;
}

/**
 * Detects decaying evergreen content:
 * - Post age >= 90 days
 * - Prior 30d impressions >= 100
 * - Drop in impressions or clicks >= 25% comparing current 30d vs prior 30d
 * DecayScore = dropPct * priorImpressions
 */
export function detectContentDecay(
  pages: ContentDecayPageInput[],
  options?: ContentDecayOptions
): ContentDecayResult[] {
  const minAgeDays = options?.minAgeDays ?? 90;
  const minPriorImpressions = options?.minPriorImpressions ?? 100;
  const dropThresholdPct = options?.dropThresholdPct ?? 0.25;
  const now = options?.now ?? new Date();

  const results: ContentDecayResult[] = [];

  for (const page of pages) {
    const pubDate = new Date(page.publishedAt);
    const ageDays = (now.getTime() - pubDate.getTime()) / (1000 * 60 * 60 * 24);

    if (ageDays < minAgeDays) {
      continue;
    }

    if (page.prior30d.impressions < minPriorImpressions) {
      continue;
    }

    const dropImpressionsPct =
      (page.prior30d.impressions - page.current30d.impressions) / page.prior30d.impressions;

    const dropClicksPct =
      page.prior30d.clicks > 0
        ? (page.prior30d.clicks - page.current30d.clicks) / page.prior30d.clicks
        : 0;

    // Must exhibit >= 25% drop in impressions or clicks
    if (dropImpressionsPct < dropThresholdPct && dropClicksPct < dropThresholdPct) {
      continue;
    }

    const maxDrop = Math.max(dropImpressionsPct, dropClicksPct);
    const decayScore = Math.round(maxDrop * page.prior30d.impressions * 100) / 100;

    const slug = extractSlugFromPage(page.page);

    results.push({
      page: page.page,
      slug,
      silo: page.silo,
      publishedAt: page.publishedAt,
      ageDays: Math.floor(ageDays),
      currentImpressions: page.current30d.impressions,
      priorImpressions: page.prior30d.impressions,
      currentClicks: page.current30d.clicks,
      priorClicks: page.prior30d.clicks,
      dropImpressionsPct: Math.round(dropImpressionsPct * 1000) / 1000,
      dropClicksPct: Math.round(dropClicksPct * 1000) / 1000,
      decayScore,
    });
  }

  // Sort descending by decay score
  results.sort((a, b) => b.decayScore - a.decayScore);

  return results;
}

/**
 * Builds actionable RefreshQueueItems from content decay detection results.
 */
export function buildContentDecayQueueItems(
  decayResults: ContentDecayResult[],
  now: Date = new Date()
): RefreshQueueItem[] {
  const monthStr = now.toISOString().slice(0, 7);

  return decayResults.map((decay) => {
    // Priority scaled 1 to 10
    const priority = Math.min(10, Math.max(1, Math.round(decay.decayScore / 100) || 6));

    return {
      id: `decay-${decay.slug}-${monthStr}`,
      slug: decay.slug,
      silo: decay.silo ?? 'ai-writing',
      type: 'content-decay',
      priority,
      detectedAt: now.toISOString(),
      status: 'pending',
      diagnostics: {
        currentImpressions: decay.currentImpressions,
        priorImpressions: decay.priorImpressions,
        impressionsDropPct: decay.dropImpressionsPct,
      },
      suggestedActions: [
        {
          action: 'bump-date-modified',
          details: `Article decayed ${Math.round(decay.dropImpressionsPct * 100)}% over 30d; bump freshness`,
        },
        {
          action: 'repair-links',
          details: 'Audit outbound links to eliminate stale/broken references',
        },
      ],
    };
  });
}
