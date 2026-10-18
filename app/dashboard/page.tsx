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
    live: { label: 'LIVE GSC & PLAUSIBLE', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    snapshot: { label: 'CACHED SNAPSHOT', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
    synthetic: { label: 'SYNTHETIC DEMO', bg: 'bg-purple-50 text-purple-700 border-purple-200' },
  }[analytics.source];

  const indexRatioPercent = (analytics.sitemapRatio.ratio * 100).toFixed(1);
  const isIndexRatioHealthy = analytics.sitemapRatio.ratio >= 0.7;

  return (
    <main className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8 text-slate-900 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Header */}
        <header className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Growth Analytics & Compounding Dashboard
              </h1>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${sourceBadge.bg}`}
              >
                {sourceBadge.label}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Autonomous search performance, Tier-1 audience segmentation, and sitemap health monitoring.
            </p>
          </div>
          <div className="text-right text-xs text-slate-400">
            <span>Last Updated: </span>
            <time className="font-mono text-slate-600">{new Date(analytics.fetchedAt).toLocaleString()}</time>
          </div>
        </header>

        {/* Headline KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Tier-1 Share */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-sm font-medium text-slate-500">
                <span>Tier-1 Traffic & Search Share</span>
                <span className="text-xs bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded">US · UK · CA · AU</span>
              </div>
              <div className="mt-4 flex items-baseline">
                <span className="text-4xl font-extrabold tracking-tight text-slate-900">
                  {analytics.tier1.tier1Share ?? (analytics.tier1.tier1ImpressionShare * 100).toFixed(1)}%
                </span>
                <span className="ml-2 text-xs font-medium text-emerald-600">
                  {analytics.tier1.tier1Impressions.toLocaleString()} impressions
                </span>
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-600">
              <div>
                <span className="font-semibold text-slate-800">US: </span>
                {analytics.tier1.countryBreakdown.US.impressions.toLocaleString()} ({analytics.tier1.countryBreakdown.US.clicks} clicks)
              </div>
              <div>
                <span className="font-semibold text-slate-800">UK: </span>
                {analytics.tier1.countryBreakdown.UK.impressions.toLocaleString()} ({analytics.tier1.countryBreakdown.UK.clicks} clicks)
              </div>
              <div>
                <span className="font-semibold text-slate-800">CA: </span>
                {analytics.tier1.countryBreakdown.CA.impressions.toLocaleString()} ({analytics.tier1.countryBreakdown.CA.clicks} clicks)
              </div>
              <div>
                <span className="font-semibold text-slate-800">AU: </span>
                {analytics.tier1.countryBreakdown.AU.impressions.toLocaleString()} ({analytics.tier1.countryBreakdown.AU.clicks} clicks)
              </div>
            </div>
          </div>

          {/* Card 2: Google Indexation Ratio */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-sm font-medium text-slate-500">
                <span>Google Indexation Ratio</span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded ${
                    isIndexRatioHealthy
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {isIndexRatioHealthy ? 'HEALTHY (≥70%)' : 'WARNING (<70%)'}
                </span>
              </div>
              <div className="mt-4 flex items-baseline">
                <span
                  className={`text-4xl font-extrabold tracking-tight ${
                    isIndexRatioHealthy ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  {indexRatioPercent}%
                </span>
                <span className="ml-2 text-xs font-medium text-slate-500">
                  {analytics.sitemapRatio.indexed} / {analytics.sitemapRatio.submitted} indexed
                </span>
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-slate-100">
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full ${isIndexRatioHealthy ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{ width: `${Math.min(100, Math.max(0, analytics.sitemapRatio.ratio * 100))}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Target benchmark: ≥ 70% sitemap indexation before velocity gate unlocks.
              </p>
            </div>
          </div>

          {/* Card 3: Total Search Volume & Clicks */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-sm font-medium text-slate-500">
                <span>Search Volume (28d)</span>
                <span className="text-xs bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded">GSC Live</span>
              </div>
              <div className="mt-4 flex items-baseline">
                <span className="text-4xl font-extrabold tracking-tight text-slate-900">
                  {analytics.tier1.totalImpressions.toLocaleString()}
                </span>
                <span className="ml-2 text-xs font-medium text-slate-500">impr</span>
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <div>
                <span className="font-semibold text-slate-800">{analytics.tier1.totalClicks.toLocaleString()}</span> Total Clicks
              </div>
              <div>
                <span className="font-semibold text-slate-800">
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
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-sm font-medium text-slate-500">
                <span>Reader Engagement (30d)</span>
                <span className="text-xs bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded">Plausible</span>
              </div>
              <div className="mt-4 flex items-baseline">
                <span className="text-4xl font-extrabold tracking-tight text-slate-900">
                  {analytics.tier1.totalVisitors.toLocaleString()}
                </span>
                <span className="ml-2 text-xs font-medium text-slate-500">visitors</span>
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <div>
                <span className="font-semibold text-slate-800">{analytics.tier1.tier1Visitors.toLocaleString()}</span> Tier-1 Visitors
              </div>
              <div>
                <span className="font-semibold text-slate-800">
                  {(analytics.tier1.tier1VisitorShare * 100).toFixed(1)}%
                </span>{' '}
                Share
              </div>
            </div>
          </div>
        </div>

        {/* Section 1: Top Search Queries by Tier-1 Countries */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Top Search Queries by Tier-1 Countries</h2>
              <p className="mt-1 text-xs text-slate-500">
                High-impression search terms driving organic discovery from US, UK, CA, and AU audiences.
              </p>
            </div>
            <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2.5 py-1 rounded">
              {analytics.topQueries.length} Queries
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-slate-500 font-semibold">
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
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {analytics.topQueries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No query data available.
                    </td>
                  </tr>
                ) : (
                  analytics.topQueries.map((q, idx) => (
                    <tr key={`${q.query}-${q.country}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 pl-6 pr-3 font-medium text-slate-900">{q.query}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                            ['US', 'UK', 'CA', 'AU'].includes(q.country)
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {q.country}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500 max-w-xs truncate" title={q.page}>
                        {q.page.replace(/^https?:\/\/[^/]+/, '')}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-xs">{q.position.toFixed(1)}</td>
                      <td className="px-3 py-3 text-right font-mono text-xs">{q.impressions.toLocaleString()}</td>
                      <td className="px-3 py-3 text-right font-mono text-xs font-semibold text-slate-900">{q.clicks}</td>
                      <td className="py-3 pl-3 pr-6 text-right font-mono text-xs text-emerald-600 font-semibold">
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
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Top Performing Post Pages</h2>
              <p className="mt-1 text-xs text-slate-500">
                Highest-converting organic content ranking across search engines.
              </p>
            </div>
            <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2.5 py-1 rounded">
              {analytics.topPages.length} Pages
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-slate-500 font-semibold">
                <tr>
                  <th scope="col" className="py-3.5 pl-6 pr-3 text-left">Page Path</th>
                  <th scope="col" className="px-3 py-3.5 text-right">Avg Position</th>
                  <th scope="col" className="px-3 py-3.5 text-right">Clicks</th>
                  <th scope="col" className="py-3.5 pl-3 pr-6 text-right">Impressions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {analytics.topPages.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      No page performance data available.
                    </td>
                  </tr>
                ) : (
                  analytics.topPages.map((p, idx) => (
                    <tr key={`${p.page}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 pl-6 pr-3 font-medium text-slate-900 max-w-md truncate">
                        <a
                          href={p.page}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline text-indigo-600"
                        >
                          {p.page.replace(/^https?:\/\/[^/]+/, '')}
                        </a>
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-xs">{p.avgPosition.toFixed(1)}</td>
                      <td className="px-3 py-3 text-right font-mono text-xs font-semibold text-slate-900">
                        {p.clicks.toLocaleString()}
                      </td>
                      <td className="py-3 pl-3 pr-6 text-right font-mono text-xs text-slate-600">
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
