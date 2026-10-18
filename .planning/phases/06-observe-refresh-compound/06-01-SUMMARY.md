# Phase 6: Observe, Refresh + Compound - Plan 01 Summary

**Plan:** 06-01 (Analytics Data Ingestion & Protected Dashboard Route)  
**Phase:** 06-observe-refresh-compound  
**Status:** Complete  
**Date:** 2026-10-18  

---

## Executive Overview

Plan 06-01 delivers the analytics ingestion foundation and owner-facing growth analytics dashboard (GROW-01) for TierOne AutoBlog:
1. **Multi-Dimensional Search & Engagement Ingestion**:
   - Google Search Console API client (`lib/pipeline/analytics/gsc.ts`) fetching multi-dimensional search data (`country × page × query`) and live sitemap coverage (`sitemaps.list`).
   - Plausible Stats API client (`lib/pipeline/analytics/plausible.ts`) fetching visitor counts and country breakdowns.
2. **Tier-1 Country Code Normalization**:
   - Normalized mapping of GSC ISO alpha-3 lowercase codes (`usa`, `gbr`, `can`, `aus`) and Plausible ISO alpha-2 codes (`US`, `GB`, `CA`, `AU`) into canonical Tier-1 keys (`US`, `UK`, `CA`, `AU`).
   - Calculation of deterministic headline metrics: Tier-1 Traffic & Search Share (~86.4%) and live sitemap indexation ratio against the $\ge 70\%$ benchmark.
3. **Resilience & Offline Snapshot Strategy**:
   - Zero-unhandled-exception design: missing credentials or network errors automatically degrade to cached snapshots (`content/analytics/snapshot.json`) or deterministic synthetic data based on published articles.
4. **Confidential Server Component Route (`/dashboard`)**:
   - Protected Next.js 16 App Router Server Component (`app/dashboard/page.tsx`) with zero client-side JavaScript.
   - Gated via `process.env.DASHBOARD_SECRET` token (`?token=...`), triggering `notFound()` (HTTP 404) for missing or mismatched tokens to prevent path enumeration.
   - Sets `robots: { index: false, follow: false }` metadata to prevent search engine crawler discovery.

---

## Delivered Artifacts

### 1. Ingestion Clients & Normalization Architecture
- **`lib/pipeline/analytics/types.ts`**:
  - Defines `Tier1Geo = 'US' | 'UK' | 'CA' | 'AU'`.
  - Defines `GSC_TIER1_MAP: Record<string, Tier1Geo>` mapping `usa`, `gbr`, `can`, `aus`.
  - Exports TypeScript interfaces for `GscSearchRow`, `SitemapRatioData`, `PlausibleCountryRow`, `Tier1Summary`, and `GrowthAnalyticsData`.
- **`lib/pipeline/analytics/gsc.ts`**:
  - Implements `normalizeGscCountry(code: string): string`.
  - Implements `fetchGscSearchAnalytics` using `searchconsole.searchanalytics.query` with `['country', 'page', 'query']` dimensions.
  - Implements `sitemaps.list` query to calculate submitted vs indexed sitemap counts and compute `sitemapRatio`.
  - Handles credential absence and API errors by returning `null` without throwing.
- **`lib/pipeline/analytics/plausible.ts`**:
  - Implements `fetchPlausibleStats` querying Plausible's breakdown endpoint (`visit:country` property) for `visitors,visits,bounce_rate,visit_duration`.
  - Normalizes `GB` to `UK`.
  - Degrades cleanly to `null` when `PLAUSIBLE_API_KEY` is unset.
- **`lib/pipeline/analytics/snapshot.ts`**:
  - Implements `loadAnalyticsSnapshot` and `saveAnalyticsSnapshot` with directory auto-creation.
  - Implements `generateSyntheticAnalytics` and `getOrGenerateAnalyticsSnapshot` calculating realistic, deterministic metrics from published posts in `content/posts/`.
- **`lib/pipeline/analytics/index.ts`**:
  - Unified aggregator `getDashboardAnalytics`: tries live GSC and Plausible APIs -> caches to snapshot -> falls back to `snapshot.json` -> falls back to deterministic synthetic data.
- **`content/analytics/snapshot.json`**:
  - Initialized baseline snapshot file for instant offline dashboard rendering.

### 2. Protected Dashboard Route
- **`app/dashboard/page.tsx`**:
  - Next.js 16 Server Component awaiting async `searchParams`.
  - Security token gating: validates `searchParams.token === process.env.DASHBOARD_SECRET`. Unauthorized requests trigger `notFound()`.
  - Metadata: `robots: { index: false, follow: false }`, `title: 'Growth Analytics & Compounding Dashboard | Private'`.
  - Semantic Tailwind UI layout:
    - Status badge indicating `LIVE`, `CACHED SNAPSHOT`, or `SYNTHETIC DEMO` mode.
    - Card 1: **Tier-1 Share Headline** (Large percentage with US, UK, CA, AU breakdown).
    - Card 2: **Google Indexation Ratio** (Live percentage, submitted vs indexed counts, visual benchmark indicator for $\ge 70\%$).
    - Card 3: **Total Search Volume & Clicks** (Impressions, clicks, average CTR).
    - Card 4: **Reader Engagement** (Total visitors, Tier-1 visitors, engagement share).
    - Table 1: **Top Search Queries by Tier-1 Countries** (Query, Country badge, URL, Position, Impressions, Clicks, CTR).
    - Table 2: **Top Performing Post Pages** (Path, Avg Position, Clicks, Impressions).

---

## Verification & Test Results

### 1. `tests/dashboard-route.test.ts` (12 tests passed)
- `normalizeGscCountry`: maps GSC alpha-3 lowercase codes (`usa`, `gbr`, `can`, `aus`) to canonical Tier-1 standard keys (`US`, `UK`, `CA`, `AU`).
- `GSC_TIER1_MAP`: contains correct key-value mappings.
- `fetchGscSearchAnalytics`: returns null gracefully without credentials.
- `fetchGscSearchAnalytics`: correctly aggregates mock API search and sitemap responses.
- `fetchPlausibleStats`: returns null gracefully when `PLAUSIBLE_API_KEY` is unset.
- `generateSyntheticAnalytics`: produces realistic figures ($\ge 70\%$ indexation ratio, $\ge 80\%$ Tier-1 share).
- `saveAnalyticsSnapshot` / `loadAnalyticsSnapshot`: verifies file persistence and retrieval.
- `getDashboardAnalytics`: coordinates data and falls back safely to snapshot/synthetic data.
- Dashboard metadata: verifies `{ index: false, follow: false }` robots configuration.
- `validateDashboardToken`: validates token presence and exact match against `DASHBOARD_SECRET`.
- `DashboardPage` unauthorized access: confirms missing or invalid tokens fail closed and trigger `notFound()`.
- `DashboardPage` authorized access: renders valid React Server Component markup with matching secret token.

### 2. Full Regression & Template Checks
- `npm run check:template`: 6/6 published articles pass frontmatter and structure validation.
- `npm test`: 79/79 tests passed across all test suites with 0 failures.

---

## Threat Model Compliance

- **T-06-01 (Sensitive Search Analytics Exposure & Pipeline Crash):** The `/dashboard` route exports `robots: { index: false, follow: false }`. Fetchers cleanly return `null` when external credentials are absent, falling back to cached snapshots or deterministic synthetic data without crashing.
- **T-06-02 (Unauthorized Dashboard Access & Token Leakage):** Access without a valid `?token=` parameter calls Next.js's `notFound()`, returning a standard 404 rather than 401/403 to prevent path enumeration by scrapers.
