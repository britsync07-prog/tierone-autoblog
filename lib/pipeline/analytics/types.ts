export type Tier1Geo = 'US' | 'UK' | 'CA' | 'AU';

export const GSC_TIER1_MAP: Record<string, Tier1Geo> = {
  usa: 'US',
  gbr: 'UK',
  can: 'CA',
  aus: 'AU',
};

export interface GscSearchRow {
  country: string;
  page: string;
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SitemapRatioData {
  submitted: number;
  indexed: number;
  ratio: number;
  sitemaps: Array<{
    path: string;
    submitted: number;
    indexed: number;
  }>;
}

export interface PlausibleCountryRow {
  country: string;
  visitors: number;
  visits: number;
  bounceRate: number;
  visitDuration: number;
}

export interface Tier1Summary {
  totalImpressions: number;
  tier1Impressions: number;
  tier1ImpressionShare: number;
  totalClicks: number;
  tier1Clicks: number;
  tier1ClickShare: number;
  totalVisitors: number;
  tier1Visitors: number;
  tier1VisitorShare: number;
  tier1Share?: number;
  countryBreakdown: Record<
    Tier1Geo | 'OTHER',
    {
      impressions: number;
      clicks: number;
      visitors: number;
    }
  >;
}

export interface GrowthAnalyticsData {
  source: 'live' | 'snapshot' | 'synthetic';
  fetchedAt: string;
  tier1Share?: number;
  sitemapRatio: SitemapRatioData;
  tier1: Tier1Summary;
  topQueries: GscSearchRow[];
  topPages: Array<{
    page: string;
    clicks: number;
    impressions: number;
    avgPosition: number;
  }>;
}
