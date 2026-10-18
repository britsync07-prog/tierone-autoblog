import { SITE_URL } from '@/lib/site';
import { fetchGscSearchAnalytics } from './gsc';
import { fetchPlausibleStats } from './plausible';
import {
  generateSyntheticAnalytics,
  loadAnalyticsSnapshot,
  saveAnalyticsSnapshot,
} from './snapshot';
import type {
  GrowthAnalyticsData,
  GscSearchRow,
  PlausibleCountryRow,
  SitemapRatioData,
  Tier1Geo,
  Tier1Summary,
} from './types';

export * from './types';
export * from './gsc';
export * from './plausible';
export * from './snapshot';

export interface GetDashboardAnalyticsOptions {
  forceLive?: boolean;
  snapshotPath?: string;
  postsDir?: string;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export async function getDashboardAnalytics(
  options?: GetDashboardAnalyticsOptions
): Promise<GrowthAnalyticsData> {
  const hasGscCreds = Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY
  );
  const hasPlausibleCreds = Boolean(process.env.PLAUSIBLE_API_KEY);

  if (options?.forceLive || hasGscCreds || hasPlausibleCreds) {
    try {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const lookback = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);

      const [gscResult, plausibleResult] = await Promise.all([
        hasGscCreds || options?.forceLive
          ? fetchGscSearchAnalytics({
              siteUrl: SITE_URL,
              startDate: formatDate(lookback),
              endDate: formatDate(yesterday),
            })
          : Promise.resolve(null),
        hasPlausibleCreds || options?.forceLive
          ? fetchPlausibleStats({
              siteId: SITE_URL.replace(/^https?:\/\//, ''),
              period: '30d',
            })
          : Promise.resolve(null),
      ]);

      if (gscResult || plausibleResult) {
        const rows = gscResult?.rows || [];
        const sitemapRatio = gscResult?.sitemapRatio || {
          submitted: 0,
          indexed: 0,
          ratio: 0,
          sitemaps: [],
        };
        const plausibleRows = plausibleResult || [];

        const tier1Countries: Tier1Geo[] = ['US', 'UK', 'CA', 'AU'];

        let totalImpressions = 0;
        let tier1Impressions = 0;
        let totalClicks = 0;
        let tier1Clicks = 0;

        const countryMap: Record<
          Tier1Geo | 'OTHER',
          { impressions: number; clicks: number; visitors: number }
        > = {
          US: { impressions: 0, clicks: 0, visitors: 0 },
          UK: { impressions: 0, clicks: 0, visitors: 0 },
          CA: { impressions: 0, clicks: 0, visitors: 0 },
          AU: { impressions: 0, clicks: 0, visitors: 0 },
          OTHER: { impressions: 0, clicks: 0, visitors: 0 },
        };

        for (const row of rows) {
          totalImpressions += row.impressions;
          totalClicks += row.clicks;

          if (tier1Countries.includes(row.country as Tier1Geo)) {
            tier1Impressions += row.impressions;
            tier1Clicks += row.clicks;
            countryMap[row.country as Tier1Geo].impressions += row.impressions;
            countryMap[row.country as Tier1Geo].clicks += row.clicks;
          } else {
            countryMap.OTHER.impressions += row.impressions;
            countryMap.OTHER.clicks += row.clicks;
          }
        }

        let totalVisitors = 0;
        let tier1Visitors = 0;

        for (const pRow of plausibleRows) {
          totalVisitors += pRow.visitors;
          if (tier1Countries.includes(pRow.country as Tier1Geo)) {
            tier1Visitors += pRow.visitors;
            countryMap[pRow.country as Tier1Geo].visitors += pRow.visitors;
          } else {
            countryMap.OTHER.visitors += pRow.visitors;
          }
        }

        const tier1ImpressionShare =
          totalImpressions > 0 ? Number((tier1Impressions / totalImpressions).toFixed(4)) : 0;
        const tier1ClickShare =
          totalClicks > 0 ? Number((tier1Clicks / totalClicks).toFixed(4)) : 0;
        const tier1VisitorShare =
          totalVisitors > 0 ? Number((tier1Visitors / totalVisitors).toFixed(4)) : 0;

        const headlineShare = Number((tier1ImpressionShare * 100).toFixed(1));

        const tier1: Tier1Summary = {
          totalImpressions,
          tier1Impressions,
          tier1ImpressionShare,
          totalClicks,
          tier1Clicks,
          tier1ClickShare,
          totalVisitors,
          tier1Visitors,
          tier1VisitorShare,
          tier1Share: headlineShare,
          countryBreakdown: countryMap,
        };

        const topQueries = [...rows]
          .sort((a, b) => b.impressions - a.impressions)
          .slice(0, 25);

        const pageAgg = new Map<
          string,
          { clicks: number; impressions: number; totalPosTimesImpr: number }
        >();

        for (const row of rows) {
          const cur = pageAgg.get(row.page) || {
            clicks: 0,
            impressions: 0,
            totalPosTimesImpr: 0,
          };
          cur.clicks += row.clicks;
          cur.impressions += row.impressions;
          cur.totalPosTimesImpr += row.position * row.impressions;
          pageAgg.set(row.page, cur);
        }

        const topPages = Array.from(pageAgg.entries())
          .map(([page, stats]) => ({
            page,
            clicks: stats.clicks,
            impressions: stats.impressions,
            avgPosition:
              stats.impressions > 0
                ? Number((stats.totalPosTimesImpr / stats.impressions).toFixed(1))
                : 0,
          }))
          .sort((a, b) => b.clicks - a.clicks)
          .slice(0, 20);

        const liveData: GrowthAnalyticsData = {
          source: 'live',
          fetchedAt: new Date().toISOString(),
          tier1Share: headlineShare,
          sitemapRatio,
          tier1,
          topQueries,
          topPages,
        };

        saveAnalyticsSnapshot(liveData, options?.snapshotPath);
        return liveData;
      }
    } catch (err) {
      console.warn(
        '[analytics] Live analytics fetch encountered error, falling back:',
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  const snapshot = loadAnalyticsSnapshot(options?.snapshotPath);
  if (snapshot) {
    return {
      ...snapshot,
      source: 'snapshot',
    };
  }

  return generateSyntheticAnalytics(options?.postsDir);
}
