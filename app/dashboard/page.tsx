import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDashboardAnalytics } from '@/lib/pipeline/analytics/index';

export const metadata: Metadata = {
  title: 'Growth Analytics & Compounding Dashboard | Private',
  robots: {
    index: false,
    follow: false,
  },
};

export interface DashboardPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export function validateDashboardToken(token: string | undefined): boolean {
  const secret = process.env.DASHBOARD_SECRET;
  if (!secret || typeof token !== 'string') {
    return false;
  }
  return token === secret;
}

export default async function DashboardPage(props: DashboardPageProps) {
  const params = await props.searchParams;
  const token = typeof params.token === 'string' ? params.token : undefined;

  if (!validateDashboardToken(token)) {
    notFound();
  }

  const analytics = await getDashboardAnalytics();

  const sourceBadge = {
    live: { label: 'LIVE GSC & PLAUSIBLE', bg: 'bg-[#fe7141] text-black font-semibold' },
    snapshot: { label: 'CACHED SNAPSHOT', bg: 'bg-zinc-800 text-zinc-200' },
    synthetic: { label: 'SYNTHETIC DEMO', bg: 'bg-zinc-800 text-amber-300' },
  }[analytics.source];

  const indexRatioPercent = (analytics.sitemapRatio.ratio * 100).toFixed(1);
  const isIndexRatioHealthy = analytics.sitemapRatio.ratio >= 0.7;

  return (
    <main data-ui className="min-h-svh bg-[#0a0a0c] py-12 px-4 sm:px-6 lg:px-8 text-[#d1d1d6]">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Header */}
        <header className="rounded-sm bg-[#141418] p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Growth Analytics & Compounding Dashboard
              </h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-sm text-xs ${sourceBadge.bg}`}>
                {sourceBadge.label}
              </span>
            </div>
            <p className="mt-1 text-sm text-[#82828e]">
              Autonomous search performance, Tier-1 audience segmentation, and sitemap health monitoring.
            </p>
          </div>
          <div className="text-left md:text-right text-xs text-[#82828e]">
            <span>Last Updated: </span>
            <time className="tabular-nums text-zinc-300">{new Date(analytics.fetchedAt).toLocaleString()}</time>
          </div>
        </header>

        {/* Headline KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Tier-1 Share */}
          <div className="rounded-sm bg-[#141418] p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-[#82828e]">
                <span>Tier-1 Traffic & Search Share</span>
                <span className="text-[11px] bg-white/[0.06] text-zinc-300 px-2 py-0.5 rounded-sm">US · UK · CA · AU</span>
              </div>
              <div className="mt-4 flex items-baseline">
                <span className="text-4xl font-extrabold tracking-tight text-white tabular-nums">
                  {analytics.tier1.tier1Share ?? (analytics.tier1.tier1ImpressionShare * 100).toFixed(1)}%
                </span>
                <span className="ml-2 text-xs font-medium text-[#fe7141] tabular-nums">
                  {analytics.tier1.tier1Impressions.toLocaleString()} impr
                </span>
              </div>
            </div>
            <div className="mt-6 pt-4 grid grid-cols-2 gap-2 text-xs text-[#82828e]">
              <div>
                <span className="font-semibold text-zinc-200">US: </span>
                {analytics.tier1.countryBreakdown.US.impressions.toLocaleString()} ({analytics.tier1.countryBreakdown.US.clicks} clicks)
              </div>
              <div>
                <span className="font-semibold text-zinc-200">UK: </span>
                {analytics.tier1.countryBreakdown.UK.impressions.toLocaleString()} ({analytics.tier1.countryBreakdown.UK.clicks} clicks)
              </div>
              <div>
                <span className="font-semibold text-zinc-200">CA: </span>
                {analytics.tier1.countryBreakdown.CA.impressions.toLocaleString()} ({analytics.tier1.countryBreakdown.CA.clicks} clicks)
              </div>
              <div>
                <span className="font-semibold text-zinc-200">AU: </span>
                {analytics.tier1.countryBreakdown.AU.impressions.toLocaleString()} ({analytics.tier1.countryBreakdown.AU.clicks} clicks)
              </div>
            </div>
          </div>

          {/* Card 2: Google Indexation Ratio */}
          <div className="rounded-sm bg-[#141418] p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-[#82828e]">
                <span>Google Indexation Ratio</span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-sm ${
                    isIndexRatioHealthy
                      ? 'bg-[#fe7141] text-black'
                      : 'bg-amber-400 text-black'
                  }`}
                >
                  {isIndexRatioHealthy ? 'HEALTHY (≥70%)' : 'WARNING (<70%)'}
                </span>
              </div>
              <div className="mt-4 flex items-baseline">
                <span
                  className={`text-4xl font-extrabold tracking-tight tabular-nums ${
                    isIndexRatioHealthy ? 'text-white' : 'text-amber-400'
                  }`}
                >
                  {indexRatioPercent}%
                </span>
                <span className="ml-2 text-xs font-medium text-[#82828e] tabular-nums">
                  {analytics.sitemapRatio.indexed} / {analytics.sitemapRatio.submitted} indexed
                </span>
              </div>
            </div>
            <div className="mt-6 pt-4">
              <div className="w-full bg-[#1c1c22] rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full ${isIndexRatioHealthy ? 'bg-[#fe7141]' : 'bg-amber-400'}`}
                  style={{ width: `${Math.min(100, Math.max(0, analytics.sitemapRatio.ratio * 100))}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-[#82828e]">
                Target benchmark: ≥ 70% sitemap indexation before velocity gate unlocks.
              </p>
            </div>
          </div>

          {/* Card 3: Total Search Volume & Clicks */}
          <div className="rounded-sm bg-[#141418] p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-[#82828e]">
                <span>Search Volume (28d)</span>
                <span className="text-[11px] bg-white/[0.06] text-zinc-300 font-semibold px-2 py-0.5 rounded-sm">GSC Live</span>
              </div>
              <div className="mt-4 flex items-baseline">
                <span className="text-4xl font-extrabold tracking-tight text-white tabular-nums">
                  {analytics.tier1.totalImpressions.toLocaleString()}
                </span>
                <span className="ml-2 text-xs font-medium text-[#82828e]">impr</span>
              </div>
            </div>
            <div className="mt-6 pt-4 flex items-center justify-between text-xs text-[#82828e]">
              <div>
                <span className="font-semibold text-white tabular-nums">{analytics.tier1.totalClicks.toLocaleString()}</span> Total Clicks
              </div>
              <div>
                <span className="font-semibold text-[#fe7141] tabular-nums">
                  {analytics.tier1.totalImpressions > 0
                    ? ((analytics.tier1.totalClicks / analytics.tier1.totalImpressions) * 100).toFixed(2)
                    : '0.00'}
                  %
                </span>{' '}
                CTR
              </div>
            </div>
          </div>

          {/* Card 4: Plausible Engagement */}
          <div className="rounded-sm bg-[#141418] p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-[#82828e]">
                <span>Reader Engagement (30d)</span>
                <span className="text-[11px] bg-white/[0.06] text-zinc-300 font-semibold px-2 py-0.5 rounded-sm">Plausible</span>
              </div>
              <div className="mt-4 flex items-baseline">
                <span className="text-4xl font-extrabold tracking-tight text-white tabular-nums">
                  {analytics.tier1.totalVisitors.toLocaleString()}
                </span>
                <span className="ml-2 text-xs font-medium text-[#82828e]">visitors</span>
              </div>
            </div>
            <div className="mt-6 pt-4 flex items-center justify-between text-xs text-[#82828e]">
              <div>
                <span className="font-semibold text-white tabular-nums">{analytics.tier1.tier1Visitors.toLocaleString()}</span> Tier-1 Visitors
              </div>
              <div>
                <span className="font-semibold text-[#fe7141] tabular-nums">
                  {(analytics.tier1.tier1VisitorShare * 100).toFixed(1)}%
                </span>{' '}
                Share
              </div>
            </div>
          </div>
        </div>

        {/* Section 1: Top Search Queries by Tier-1 Countries */}
        <section className="rounded-sm bg-[#141418] overflow-hidden">
          <div className="p-6 bg-[#18181f] flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Top Search Queries by Tier-1 Countries</h2>
              <p className="mt-1 text-xs text-[#82828e]">
                High-impression search terms driving organic discovery from US, UK, CA, and AU audiences.
              </p>
            </div>
            <span className="text-xs font-medium bg-white/[0.06] text-zinc-300 px-2.5 py-1 rounded-sm">
              {analytics.topQueries.length} Queries
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#141418] text-[#82828e] font-semibold text-xs">
                <tr>
                  <th scope="col" className="py-3.5 pl-6 pr-3 text-left">Query</th>
                  <th scope="col" className="px-3 py-3.5 text-left">Country</th>
                  <th scope="col" className="px-3 py-3.5 text-left">Target URL</th>
                  <th scope="col" className="px-3 py-3.5 text-right">Avg Position</th>
                  <th scope="col" className="px-3 py-3.5 text-right">28d Impressions</th>
                  <th scope="col" className="px-3 py-3.5 text-right">Clicks</th>
                  <th scope="col" className="py-3.5 pl-3 pr-6 text-right">CTR</th>
                </tr>
              </thead>
              <tbody className="text-[#d1d1d6]">
                {analytics.topQueries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#82828e]">
                      No query data available.
                    </td>
                  </tr>
                ) : (
                  analytics.topQueries.map((q, idx) => (
                    <tr key={`${q.query}-${q.country}-${idx}`} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 pl-6 pr-3 font-semibold text-white">{q.query}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-bold ${
                            ['US', 'UK', 'CA', 'AU'].includes(q.country)
                              ? 'bg-[#fe7141]/10 text-[#fe7141]'
                              : 'bg-white/[0.06] text-zinc-300'
                          }`}
                        >
                          {q.country}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-[#82828e] max-w-xs truncate" title={q.page}>
                        {q.page.replace(/^https?:\/\/[^/]+/, '')}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-xs text-zinc-300">{q.position.toFixed(1)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-xs text-zinc-300">{q.impressions.toLocaleString()}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-xs font-bold text-white">{q.clicks}</td>
                      <td className="py-3 pl-3 pr-6 text-right tabular-nums text-xs text-[#fe7141] font-bold">
                        {(q.ctr * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 2: Top Performing Post Pages */}
        <section className="rounded-sm bg-[#141418] overflow-hidden">
          <div className="p-6 bg-[#18181f] flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Top Performing Post Pages</h2>
              <p className="mt-1 text-xs text-[#82828e]">
                Highest-converting organic content ranking across search engines.
              </p>
            </div>
            <span className="text-xs font-medium bg-white/[0.06] text-zinc-300 px-2.5 py-1 rounded-sm">
              {analytics.topPages.length} Pages
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#141418] text-[#82828e] font-semibold text-xs">
                <tr>
                  <th scope="col" className="py-3.5 pl-6 pr-3 text-left">Page Path</th>
                  <th scope="col" className="px-3 py-3.5 text-right">Avg Position</th>
                  <th scope="col" className="px-3 py-3.5 text-right">Clicks</th>
                  <th scope="col" className="py-3.5 pl-3 pr-6 text-right">Impressions</th>
                </tr>
              </thead>
              <tbody className="text-[#d1d1d6]">
                {analytics.topPages.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-[#82828e]">
                      No page performance data available.
                    </td>
                  </tr>
                ) : (
                  analytics.topPages.map((p, idx) => (
                    <tr key={`${p.page}-${idx}`} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 pl-6 pr-3 font-semibold text-white max-w-md truncate">
                        <a
                          href={p.page}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline text-[#fe7141] transition-colors"
                        >
                          {p.page.replace(/^https?:\/\/[^/]+/, '')}
                        </a>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-xs text-zinc-300">{p.avgPosition.toFixed(1)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-xs font-bold text-white">
                        {p.clicks.toLocaleString()}
                      </td>
                      <td className="py-3 pl-3 pr-6 text-right tabular-nums text-xs text-[#82828e]">
                        {p.impressions.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
