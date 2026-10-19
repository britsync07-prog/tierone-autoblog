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
    live: { label: 'LIVE GSC & PLAUSIBLE', bg: 'bg-[#d92b21] text-white font-semibold' },
    snapshot: { label: 'CACHED SNAPSHOT', bg: 'bg-[#e4e4e7] text-[#09090b]' },
    synthetic: { label: 'SYNTHETIC DEMO', bg: 'bg-[#e4e4e7] text-[#b45309]' },
  }[analytics.source];

  const indexRatioPercent = (analytics.sitemapRatio.ratio * 100).toFixed(1);
  const isIndexRatioHealthy = analytics.sitemapRatio.ratio >= 0.7;

  return (
    <main data-ui className="min-h-svh bg-white py-12 px-4 sm:px-6 lg:px-8 text-[#27272a]">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Header */}
        <header className="rounded-sm bg-[#f4f4f6] p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#09090b]">
                Growth Analytics & Compounding Dashboard
              </h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-sm text-xs ${sourceBadge.bg}`}>
                {sourceBadge.label}
              </span>
            </div>
            <p className="mt-1 text-sm text-[#52525b]">
              Autonomous search performance, Tier-1 audience segmentation, and sitemap health monitoring.
            </p>
          </div>
          <div className="text-left md:text-right text-xs text-[#52525b]">
            <span>Last Updated: </span>
            <time className="tabular-nums text-[#09090b] font-medium">{new Date(analytics.fetchedAt).toLocaleString()}</time>
          </div>
        </header>

        {/* Headline KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Tier-1 Share */}
          <div className="rounded-sm bg-[#f4f4f6] p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-[#52525b]">
                <span>Tier-1 Traffic & Search Share</span>
                <span className="text-[11px] bg-[#e4e4e7] text-[#09090b] font-semibold px-2 py-0.5 rounded-sm">US · UK · CA · AU</span>
              </div>
              <div className="mt-4 flex items-baseline">
                <span className="text-4xl font-extrabold tracking-tight text-[#09090b] tabular-nums">
                  {analytics.tier1.tier1Share ?? (analytics.tier1.tier1ImpressionShare * 100).toFixed(1)}%
                </span>
                <span className="ml-2 text-xs font-medium text-[#d92b21] tabular-nums">
                  {analytics.tier1.tier1Impressions.toLocaleString()} impr
                </span>
              </div>
            </div>
            <div className="mt-6 pt-4 grid grid-cols-2 gap-2 text-xs text-[#52525b]">
              <div>
                <span className="font-semibold text-[#09090b]">US: </span>
                {analytics.tier1.countryBreakdown.US.impressions.toLocaleString()} ({analytics.tier1.countryBreakdown.US.clicks} clicks)
              </div>
              <div>
                <span className="font-semibold text-[#09090b]">UK: </span>
                {analytics.tier1.countryBreakdown.UK.impressions.toLocaleString()} ({analytics.tier1.countryBreakdown.UK.clicks} clicks)
              </div>
              <div>
                <span className="font-semibold text-[#09090b]">CA: </span>
                {analytics.tier1.countryBreakdown.CA.impressions.toLocaleString()} ({analytics.tier1.countryBreakdown.CA.clicks} clicks)
              </div>
              <div>
                <span className="font-semibold text-[#09090b]">AU: </span>
                {analytics.tier1.countryBreakdown.AU.impressions.toLocaleString()} ({analytics.tier1.countryBreakdown.AU.clicks} clicks)
              </div>
            </div>
          </div>

          {/* Card 2: Google Indexation Ratio */}
          <div className="rounded-sm bg-[#f4f4f6] p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-[#52525b]">
                <span>Google Indexation Ratio</span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-sm ${
                    isIndexRatioHealthy
                      ? 'bg-[#d92b21] text-white'
                      : 'bg-amber-400 text-black'
                  }`}
                >
                  {isIndexRatioHealthy ? 'HEALTHY (≥70%)' : 'WARNING (<70%)'}
                </span>
              </div>
              <div className="mt-4 flex items-baseline">
                <span
                  className={`text-4xl font-extrabold tracking-tight tabular-nums ${
                    isIndexRatioHealthy ? 'text-[#09090b]' : 'text-amber-600'
                  }`}
                >
                  {indexRatioPercent}%
                </span>
                <span className="ml-2 text-xs font-medium text-[#52525b] tabular-nums">
                  {analytics.sitemapRatio.indexed} / {analytics.sitemapRatio.submitted} indexed
                </span>
              </div>
            </div>
            <div className="mt-6 pt-4">
              <div className="w-full bg-[#e4e4e7] rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full ${isIndexRatioHealthy ? 'bg-[#d92b21]' : 'bg-amber-500'}`}
                  style={{ width: `${Math.min(100, Math.max(0, analytics.sitemapRatio.ratio * 100))}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-[#52525b]">
                Target benchmark: ≥ 70% sitemap indexation before velocity gate unlocks.
              </p>
            </div>
          </div>

          {/* Card 3: Total Search Volume & Clicks */}
          <div className="rounded-sm bg-[#f4f4f6] p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-[#52525b]">
                <span>Search Volume (28d)</span>
                <span className="text-[11px] bg-[#e4e4e7] text-[#09090b] font-semibold px-2 py-0.5 rounded-sm">GSC Live</span>
              </div>
              <div className="mt-4 flex items-baseline">
                <span className="text-4xl font-extrabold tracking-tight text-[#09090b] tabular-nums">
                  {analytics.tier1.totalImpressions.toLocaleString()}
                </span>
                <span className="ml-2 text-xs font-medium text-[#52525b]">impr</span>
              </div>
            </div>
            <div className="mt-6 pt-4 flex items-center justify-between text-xs text-[#52525b]">
              <div>
                <span className="font-semibold text-[#09090b] tabular-nums">{analytics.tier1.totalClicks.toLocaleString()}</span> Total Clicks
              </div>
              <div>
                <span className="font-semibold text-[#d92b21] tabular-nums">
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
          <div className="rounded-sm bg-[#f4f4f6] p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-[#52525b]">
                <span>Reader Engagement (30d)</span>
                <span className="text-[11px] bg-[#e4e4e7] text-[#09090b] font-semibold px-2 py-0.5 rounded-sm">Plausible</span>
              </div>
              <div className="mt-4 flex items-baseline">
                <span className="text-4xl font-extrabold tracking-tight text-[#09090b] tabular-nums">
                  {analytics.tier1.totalVisitors.toLocaleString()}
                </span>
                <span className="ml-2 text-xs font-medium text-[#52525b]">visitors</span>
              </div>
            </div>
            <div className="mt-6 pt-4 flex items-center justify-between text-xs text-[#52525b]">
              <div>
                <span className="font-semibold text-[#09090b] tabular-nums">{analytics.tier1.tier1Visitors.toLocaleString()}</span> Tier-1 Visitors
              </div>
              <div>
                <span className="font-semibold text-[#d92b21] tabular-nums">
                  {(analytics.tier1.tier1VisitorShare * 100).toFixed(1)}%
                </span>{' '}
                Share
              </div>
            </div>
          </div>
        </div>

        {/* Section 1: Top Search Queries by Tier-1 Countries */}
        <section className="rounded-sm bg-[#f4f4f6] overflow-hidden">
          <div className="p-6 bg-[#ebebee] flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#09090b]">Top Search Queries by Tier-1 Countries</h2>
              <p className="mt-1 text-xs text-[#52525b]">
                High-impression search terms driving organic discovery from US, UK, CA, and AU audiences.
              </p>
            </div>
            <span className="text-xs font-medium bg-[#e4e4e7] text-[#09090b] px-2.5 py-1 rounded-sm">
              {analytics.topQueries.length} Queries
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#e4e4e7] text-[#52525b] font-semibold text-xs">
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
              <tbody className="text-[#27272a]">
                {analytics.topQueries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#52525b]">
                      No query data available.
                    </td>
                  </tr>
                ) : (
                  analytics.topQueries.map((q, idx) => (
                    <tr key={`${q.query}-${q.country}-${idx}`} className="hover:bg-black/[0.02] transition-colors">
                      <td className="py-3 pl-6 pr-3 font-semibold text-[#09090b]">{q.query}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-bold ${
                            ['US', 'UK', 'CA', 'AU'].includes(q.country)
                              ? 'bg-[#d92b21]/10 text-[#d92b21]'
                              : 'bg-[#e4e4e7] text-[#09090b]'
                          }`}
                        >
                          {q.country}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-[#52525b] max-w-xs truncate" title={q.page}>
                        {q.page.replace(/^https?:\/\/[^/]+/, '')}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-xs text-[#52525b]">{q.position.toFixed(1)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-xs text-[#52525b]">{q.impressions.toLocaleString()}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-xs font-bold text-[#09090b]">{q.clicks}</td>
                      <td className="py-3 pl-3 pr-6 text-right tabular-nums text-xs text-[#d92b21] font-bold">
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
        <section className="rounded-sm bg-[#f4f4f6] overflow-hidden">
          <div className="p-6 bg-[#ebebee] flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#09090b]">Top Performing Post Pages</h2>
              <p className="mt-1 text-xs text-[#52525b]">
                Highest-converting organic content ranking across search engines.
              </p>
            </div>
            <span className="text-xs font-medium bg-[#e4e4e7] text-[#09090b] px-2.5 py-1 rounded-sm">
              {analytics.topPages.length} Pages
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#e4e4e7] text-[#52525b] font-semibold text-xs">
                <tr>
                  <th scope="col" className="py-3.5 pl-6 pr-3 text-left">Page Path</th>
                  <th scope="col" className="px-3 py-3.5 text-right">Avg Position</th>
                  <th scope="col" className="px-3 py-3.5 text-right">Clicks</th>
                  <th scope="col" className="py-3.5 pl-3 pr-6 text-right">Impressions</th>
                </tr>
              </thead>
              <tbody className="text-[#27272a]">
                {analytics.topPages.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-[#52525b]">
                      No page performance data available.
                    </td>
                  </tr>
                ) : (
                  analytics.topPages.map((p, idx) => (
                    <tr key={`${p.page}-${idx}`} className="hover:bg-black/[0.02] transition-colors">
                      <td className="py-3 pl-6 pr-3 font-semibold text-[#09090b] max-w-md truncate">
                        <a
                          href={p.page}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline text-[#d92b21] transition-colors"
                        >
                          {p.page.replace(/^https?:\/\/[^/]+/, '')}
                        </a>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-xs text-[#52525b]">{p.avgPosition.toFixed(1)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-xs font-bold text-[#09090b]">
                        {p.clicks.toLocaleString()}
                      </td>
                      <td className="py-3 pl-3 pr-6 text-right tabular-nums text-xs text-[#52525b]">
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
