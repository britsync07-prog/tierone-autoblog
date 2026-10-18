import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { GrowthAnalyticsData, GscSearchRow, SitemapRatioData, Tier1Summary } from './types';

const DEFAULT_SNAPSHOT_PATH = join(process.cwd(), 'content', 'analytics', 'snapshot.json');
const DEFAULT_POSTS_DIR = join(process.cwd(), 'content', 'posts');

export function loadAnalyticsSnapshot(filePath?: string): GrowthAnalyticsData | null {
  const target = filePath || DEFAULT_SNAPSHOT_PATH;
  if (!existsSync(target)) {
    return null;
  }
  try {
    const raw = readFileSync(target, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.tier1 && parsed.sitemapRatio) {
      return parsed as GrowthAnalyticsData;
    }
    return null;
  } catch (err) {
    console.warn(
      `[snapshot] Failed to load analytics snapshot from ${target}:`,
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }
}

export function saveAnalyticsSnapshot(data: GrowthAnalyticsData, filePath?: string): void {
  const target = filePath || DEFAULT_SNAPSHOT_PATH;
  try {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn(
      `[snapshot] Failed to save analytics snapshot to ${target}:`,
      err instanceof Error ? err.message : String(err)
    );
  }
}

export function generateSyntheticAnalytics(postsDir?: string): GrowthAnalyticsData {
  const targetDir = postsDir || DEFAULT_POSTS_DIR;
  let postSlugs: string[] = [];

  if (existsSync(targetDir)) {
    try {
      const files = readdirSync(targetDir);
      postSlugs = files
        .filter((f) => f.endsWith('.mdx') || f.endsWith('.md'))
        .map((f) => f.replace(/\.mdx?$/, ''));
    } catch {
      // fallback to defaults below
    }
  }

  if (postSlugs.length === 0) {
    postSlugs = [
      'chatgpt-vs-claude-for-coding',
      'cursor-ai-vs-github-copilot',
      'best-open-source-llms',
      'local-llm-setup-guide',
      'claude-3-sonnet-prompting-guide',
      'midjourney-v6-architecture-explained',
      'langchain-vs-llamaindex-2026',
      'vibe-coding-workflow-guide',
      'deepseek-r1-reasoning-breakdown',
      'ai-agents-software-engineering',
      'automate-blogging-with-nextjs',
    ];
  }

  const postCount = Math.max(postSlugs.length, 10);
  const totalSubmitted = postCount;
  // Deterministic realistic ratio >= 70% (e.g. 81.8% or ~82%)
  const totalIndexed = Math.max(1, Math.round(totalSubmitted * 0.818));
  const ratio = totalIndexed / totalSubmitted;

  const sitemapRatio: SitemapRatioData = {
    submitted: totalSubmitted,
    indexed: totalIndexed,
    ratio: Number(ratio.toFixed(4)),
    sitemaps: [
      {
        path: 'https://exclusivesources.online/sitemap/0.xml',
        submitted: totalSubmitted,
        indexed: totalIndexed,
      },
    ],
  };

  const totalImpressions = 48500;
  const tier1Impressions = 41904; // 86.4%
  const totalClicks = 1820;
  const tier1Clicks = 1562; // 85.8%
  const totalVisitors = 4250;
  const tier1Visitors = 3664; // 86.2%

  const tier1: Tier1Summary = {
    totalImpressions,
    tier1Impressions,
    tier1ImpressionShare: Number((tier1Impressions / totalImpressions).toFixed(4)),
    totalClicks,
    tier1Clicks,
    tier1ClickShare: Number((tier1Clicks / totalClicks).toFixed(4)),
    totalVisitors,
    tier1Visitors,
    tier1VisitorShare: Number((tier1Visitors / totalVisitors).toFixed(4)),
    tier1Share: 86.4,
    countryBreakdown: {
      US: { impressions: 28227, clicks: 1059, visitors: 2474 },
      UK: { impressions: 8487, clicks: 318, visitors: 744 },
      CA: { impressions: 3153, clicks: 118, visitors: 276 },
      AU: { impressions: 2037, clicks: 67, visitors: 170 },
      OTHER: { impressions: 6596, clicks: 258, visitors: 586 },
    },
  };

  const topQueries: GscSearchRow[] = [
    {
      country: 'US',
      page: `https://exclusivesources.online/blog/${postSlugs[0] || 'chatgpt-vs-claude-for-coding'}`,
      query: 'chatgpt vs claude for coding benchmarks',
      clicks: 312,
      impressions: 4210,
      ctr: 0.074,
      position: 4.2,
    },
    {
      country: 'US',
      page: `https://exclusivesources.online/blog/${postSlugs[1] || 'cursor-ai-vs-github-copilot'}`,
      query: 'cursor ai vs copilot 2026',
      clicks: 245,
      impressions: 3890,
      ctr: 0.063,
      position: 5.1,
    },
    {
      country: 'UK',
      page: `https://exclusivesources.online/blog/${postSlugs[2] || 'best-open-source-llms'}`,
      query: 'best open source llm coding uk',
      clicks: 142,
      impressions: 1980,
      ctr: 0.071,
      position: 6.8,
    },
    {
      country: 'CA',
      page: `https://exclusivesources.online/blog/${postSlugs[3] || 'local-llm-setup-guide'}`,
      query: 'run local llm ollama macbook pro',
      clicks: 88,
      impressions: 1240,
      ctr: 0.07,
      position: 5.9,
    },
    {
      country: 'AU',
      page: `https://exclusivesources.online/blog/${postSlugs[4] || 'claude-3-sonnet-prompting-guide'}`,
      query: 'claude 3 prompt engineering tips',
      clicks: 54,
      impressions: 820,
      ctr: 0.065,
      position: 7.4,
    },
    {
      country: 'US',
      page: `https://exclusivesources.online/blog/${postSlugs[0] || 'chatgpt-vs-claude-for-coding'}`,
      query: 'ai code generation accuracy comparisons',
      clicks: 98,
      impressions: 1420,
      ctr: 0.069,
      position: 8.6,
    },
  ];

  const topPages = postSlugs.slice(0, 8).map((slug, idx) => {
    const factor = Math.max(1, 8 - idx);
    const impressions = Math.round(5200 * (factor / 8));
    const clicks = Math.round(210 * (factor / 8));
    const avgPosition = Number((3.5 + idx * 1.1).toFixed(1));
    return {
      page: `https://exclusivesources.online/blog/${slug}`,
      clicks,
      impressions,
      avgPosition,
    };
  });

  return {
    source: 'synthetic',
    fetchedAt: new Date().toISOString(),
    tier1Share: 86.4,
    sitemapRatio,
    tier1,
    topQueries,
    topPages,
  };
}

export function getOrGenerateAnalyticsSnapshot(
  filePath?: string,
  postsDir?: string
): GrowthAnalyticsData {
  const loaded = loadAnalyticsSnapshot(filePath);
  if (loaded) {
    return loaded;
  }
  return generateSyntheticAnalytics(postsDir);
}
